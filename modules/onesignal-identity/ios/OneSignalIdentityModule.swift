import ExpoModulesCore
import OneSignalFramework

/**
 NTF-APP-004 (#51) — identity-verified login.

 `react-native-onesignal` 5.5.9 declares `login(externalId: string): void` and
 nothing else: its TurboModule spec has no token parameter, and the string
 "jwt" does not appear anywhere in the wrapper's `src`, `ios` or `android`.
 The *native* SDK it vendors is a different story — OneSignalXCFramework 5.5.6
 declares:

     + (void)login:(NSString *)externalId withToken:(NSString * _Nullable)token
     - (void)onJwtExpiredWithExpiredHandler:(void (^)(NSString *, void (^)(NSString *)))h

 So identity verification is supported by the SDK in this binary; only the JS
 surface omits it. This module is that surface, and nothing more: it calls the
 same singleton the wrapper drives, so `initialize` still belongs to
 `react-native-onesignal` and only login/logout come through here.

 The token is never logged, never stored, and never returned to JS.
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

    /// The SDK asks for a fresh token when the one it holds expires or is
    /// refused. JS answers with `respondToJwtExpired`; until it does, the SDK
    /// holds the request open, which is the retry behaviour rather than a
    /// silent logout.
    OnStartObserving("onJwtExpired") { [weak self] in
      OneSignal.User.onJwtExpired { [weak self] externalId, complete in
        self?.pendingCompletions[externalId] = complete
        self?.sendEvent("onJwtExpired", ["externalId": externalId])
      }
    }

    AsyncFunction("respondToJwtExpired") { (externalId: String, token: String) in
      guard let complete = self.pendingCompletions.removeValue(forKey: externalId) else { return }
      complete(token)
    }
  }

  private var pendingCompletions: [String: (String) -> Void] = [:]
}
