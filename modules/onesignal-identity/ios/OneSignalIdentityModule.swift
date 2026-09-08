import ExpoModulesCore
import OneSignalFramework
import OneSignalUser

/**
 NTF-APP-004 (#51) — identity-verified login.

 `react-native-onesignal` 5.5.9 declares `login(externalId: string): void` and
 nothing else: its TurboModule spec has no token parameter, and the string
 "jwt" does not appear anywhere in the wrapper's `src`, `ios` or `android`.
 The *native* SDK exposes the whole thing, so this module is that surface and
 nothing more: it drives the same singleton the wrapper initialises, so
 `initialize` still belongs to `react-native-onesignal` and only login/logout
 come through here.

 The token is never logged, never stored, and never returned to JS.

 ## Which iOS SDK this needs

 Identity Verification on iOS requires **OneSignalXCFramework 5.3.0-beta-03**.
 OneSignal support confirmed on 2026-09-08 that the general 5.5.x releases do
 not support it, and the framework bears that out: 5.5.6 declares only
 `onJwtExpiredWithExpiredHandler:` and none of the identity APIs, while
 5.3.0-beta-03 declares `addUserJwtInvalidatedListener:`,
 `removeUserJwtInvalidatedListener:` and `updateUserJwtWithExternalId:token:`
 and drops `onJwtExpired` entirely. The two are mutually exclusive, so this file
 only compiles against the beta — see the Podfile pin.

 That also means the platforms now agree. Android's `IUserJwtInvalidatedListener`
 + `updateUserJwt` and iOS's `OSUserJwtInvalidatedListener` + `updateUserJwt`
 are the same shape, so `identity-session.ts` sees one contract: an
 `onJwtExpired` event, then `respondToJwtExpired`. The earlier asymmetry existed
 only because 5.5.6 had no other option.
 */

/**
 Bridges the SDK's listener protocol to a closure.

 The protocol needs a class, and the SDK holds the listener weakly enough that
 an inline object would be collected before the first event — so the module
 keeps a strong reference and removes it when JS stops observing.
 */
private final class JwtInvalidatedForwarder: NSObject, OSUserJwtInvalidatedListener {
  private let onInvalidated: (String) -> Void

  init(onInvalidated: @escaping (String) -> Void) {
    self.onInvalidated = onInvalidated
  }

  func onUserJwtInvalidated(event: OSUserJwtInvalidatedEvent) {
    onInvalidated(event.externalId)
  }
}

public final class OneSignalIdentityModule: Module {
  private var jwtListener: JwtInvalidatedForwarder?

  public func definition() -> ModuleDefinition {
    Name("OneSignalIdentity")

    Events("onJwtExpired")

    /// Bind this device's subscription to `externalId`, proving it with the
    /// short-lived ES256 token from `GET /v1/notifications/identity`.
    AsyncFunction("loginWithToken") { (externalId: String, token: String) in
      guard !externalId.isEmpty else {
        throw Exception(name: "ERR_EXTERNAL_ID", description: "externalId is required")
      }
      guard !token.isEmpty else {
        // A caller that has no token must call `login` deliberately, not get an
        // unverified login by accident because a fetch returned empty.
        throw Exception(name: "ERR_TOKEN", description: "identity token is required")
      }
      OneSignal.login(externalId: externalId, token: token)
    }

    /// Unverified login, for an environment that holds no signing key. Separate
    /// on purpose: it should be visible in a stack trace which one ran.
    AsyncFunction("loginWithoutToken") { (externalId: String) in
      guard !externalId.isEmpty else {
        throw Exception(name: "ERR_EXTERNAL_ID", description: "externalId is required")
      }
      OneSignal.login(externalId)
    }

    AsyncFunction("logout") {
      OneSignal.logout()
    }

    /// The SDK reports that the token it holds expired or was refused. JS
    /// answers with `respondToJwtExpired`; until it does, the device stays
    /// bound to nothing, which is the honest state.
    OnStartObserving("onJwtExpired") { [weak self] in
      guard let self, self.jwtListener == nil else { return }
      let forwarder = JwtInvalidatedForwarder { [weak self] externalId in
        self?.sendEvent("onJwtExpired", ["externalId": externalId])
      }
      self.jwtListener = forwarder
      // `OneSignal.User.addUserJwtInvalidatedListener` does not type-check: the
      // JWT APIs live on `OneSignalUserManagerImpl`, while `OneSignal.User` is
      // typed as the `OSUser` protocol, which does not declare them. The class
      // method does, and it is NS_REFINED_FOR_SWIFT, which the SDK's Swift shim
      // surfaces as `__add`/`__remove`.
      OneSignal.__add(forwarder)
    }

    OnStopObserving("onJwtExpired") { [weak self] in
      guard let self, let forwarder = self.jwtListener else { return }
      OneSignal.__remove(forwarder)
      self.jwtListener = nil
    }

    /// The fresh token, pushed in after the fact — the same call Android makes.
    AsyncFunction("respondToJwtExpired") { (externalId: String, token: String) in
      guard !externalId.isEmpty else {
        throw Exception(name: "ERR_EXTERNAL_ID", description: "externalId is required")
      }
      guard !token.isEmpty else {
        throw Exception(name: "ERR_TOKEN", description: "identity token is required")
      }
      // Carries NS_SWIFT_NAME(updateUserJwt(externalId:token:)), so this one
      // needs no prefix.
      OneSignal.updateUserJwt(externalId: externalId, token: token)
    }
  }
}
