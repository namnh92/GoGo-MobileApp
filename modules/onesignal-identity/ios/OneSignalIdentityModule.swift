import ExpoModulesCore
import OneSignalFramework

/**
 NTF-APP-004 (#51) — identity-verified login.

 `react-native-onesignal` 5.5.9 declares `login(externalId: string): void` and
 nothing else: its TurboModule spec has no token parameter, and the string
 "jwt" does not appear anywhere in the wrapper's `src`, `ios` or `android`.
 The *native* SDK it vendors is a different story — OneSignalXCFramework 5.5.6
 declares:

     - (void)loginWithExternalId:(NSString *)externalId token:(NSString * _Nullable)token
     - (void)onJwtExpiredWithExpiredHandler:(void (^)(NSString *, SWIFT_NOESCAPE void (^)(NSString *)))h

 So identity verification is supported by the SDK in this binary; only the JS
 surface omits it. This module is that surface, and nothing more: it calls the
 same singleton the wrapper drives, so `initialize` still belongs to
 `react-native-onesignal` and only login/logout come through here.

 The token is never logged, never stored, and never returned to JS.

 ## Why the expiry handler does not use its completion

 The header marks the inner block `SWIFT_NOESCAPE`: the SDK promises it will
 not outlive the handler call, and holding it past that is a use-after-free —
 not merely a compile error, though it is that too, which is how this was
 caught. Answering it would mean producing a fresh token synchronously inside
 the callback, and the token comes from `GET /v1/notifications/identity` over
 the network, via JS. That cannot happen inside a non-escaping call.

 So the handler does what Android's `IUserJwtInvalidatedListener` does: it
 reports, and the fresh token is pushed in afterwards. The push is
 `login(externalId:token:)`, the same call the initial bind uses — supplying a
 new token for an external id is exactly what it means.

 ## Why not `updateUserJwt`, which the documentation shows for iOS

 Step 4 of OneSignal's Identity Verification guide shows an iOS/Swift sample
 calling `addUserJwtInvalidatedListener` and `updateUserJwt(externalId:token:)`.
 Neither exists on iOS. Verified three ways against the version we ship,
 OneSignalXCFramework 5.5.6 — which is also the newest published release
 (2026-08-01):

   - `OneSignalUser-Swift.h` declares exactly one JWT API,
     `onJwtExpiredWithExpiredHandler:`;
   - `nm` on the `OneSignalUser` binary finds zero `updateUserJwt` and zero
     `addUserJwtInvalidatedListener` symbols, and one `onJwtExpired`;
   - GitHub code search over `OneSignal/OneSignal-iOS-SDK` returns 0 results for
     each of those two names, against 19 for `onJwtExpired` and 49 for
     `OneSignalUserManagerImpl` as controls, so the repository is indexed and
     the zeroes are real.

 Both symbols *do* exist on Android (`javap` on `com.onesignal:core:5.9.9`),
 which is where this module uses them. The iOS sample in the guide appears to be
 the Android API shown under the wrong tab. Implementing it as documented would
 not compile, so this stays as it is until OneSignal confirms; it is raised with
 them as a documentation question.

 The JS contract is therefore identical on both platforms — an `onJwtExpired`
 event, then `respondToJwtExpired` — and only the native call underneath
 differs. `identity-session.ts` never has to know which one it is on.
 */
public final class OneSignalIdentityModule: Module {
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
    /// answers later with `respondToJwtExpired`; see the note above for why the
    /// handler's own completion cannot be the channel.
    OnStartObserving("onJwtExpired") { [weak self] in
      OneSignal.User.onJwtExpired { [weak self] externalId, _ in
        self?.sendEvent("onJwtExpired", ["externalId": externalId])
      }
    }

    /// The fresh token, pushed in after the fact. Android calls
    /// `updateUserJwt`; iOS has no such method, and re-login with the new token
    /// is the documented way to hand one over.
    AsyncFunction("respondToJwtExpired") { (externalId: String, token: String) in
      guard !externalId.isEmpty else {
        throw Exception(name: "ERR_EXTERNAL_ID", description: "externalId is required")
      }
      guard !token.isEmpty else {
        throw Exception(name: "ERR_TOKEN", description: "identity token is required")
      }
      OneSignal.login(externalId: externalId, token: token)
    }
  }
}
