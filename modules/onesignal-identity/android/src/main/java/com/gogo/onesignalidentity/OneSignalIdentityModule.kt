package com.gogo.onesignalidentity

import com.onesignal.OneSignal
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * NTF-APP-004 (#51) — identity-verified login, Android half.
 *
 * See the iOS file for why this module exists: the JS wrapper's TurboModule
 * spec is `login(externalId: string): void` with no token, while the native SDK
 * it vendors (com.onesignal 5.9.9) takes one. Identity verification is
 * supported by the SDK in this binary; only the JS surface omits it.
 *
 * This drives the same singleton `react-native-onesignal` initialises, so
 * initialisation stays there and only login/logout come through here. The token
 * is never logged, never stored and never handed back to JS.
 */
class OneSignalIdentityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OneSignalIdentity")

    Events("onJwtExpired")

    AsyncFunction("loginWithToken") { externalId: String, token: String ->
      if (externalId.isEmpty()) throw CodedException("ERR_EXTERNAL_ID", "externalId is required", null)
      // A caller with no token must ask for the unverified path by name, not
      // fall into it because a fetch came back empty.
      if (token.isEmpty()) throw CodedException("ERR_TOKEN", "identity token is required", null)
      OneSignal.login(externalId, token)
    }

    AsyncFunction("loginWithoutToken") { externalId: String ->
      if (externalId.isEmpty()) throw CodedException("ERR_EXTERNAL_ID", "externalId is required", null)
      OneSignal.login(externalId)
    }

    AsyncFunction("logout") {
      OneSignal.logout()
    }

    OnStartObserving("onJwtExpired") {
      OneSignal.User.onJwtExpired { externalId, complete ->
        pendingCompletions[externalId] = complete
        sendEvent("onJwtExpired", mapOf("externalId" to externalId))
      }
    }

    AsyncFunction("respondToJwtExpired") { externalId: String, token: String ->
      pendingCompletions.remove(externalId)?.invoke(token)
    }
  }

  private val pendingCompletions = mutableMapOf<String, (String) -> Unit>()
}
