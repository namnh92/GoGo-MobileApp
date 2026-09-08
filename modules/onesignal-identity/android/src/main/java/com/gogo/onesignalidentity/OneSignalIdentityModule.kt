package com.gogo.onesignalidentity

import com.onesignal.IUserJwtInvalidatedListener
import com.onesignal.OneSignal
import com.onesignal.UserJwtInvalidatedEvent
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * NTF-APP-004 (#51) — identity-verified login, Android half.
 *
 * See the iOS file for why this module exists: the JS wrapper's TurboModule
 * spec is `login(externalId: string): void` with no token, while the native SDK
 * it vendors takes one. Verified against the real artefact rather than the
 * docs — `javap` on `com.onesignal:core:5.9.9` reports:
 *
 *     public static final void login(java.lang.String, java.lang.String);
 *     public static final void updateUserJwt(java.lang.String, java.lang.String);
 *     public static final void addUserJwtInvalidatedListener(IUserJwtInvalidatedListener);
 *
 * The two platforms differ in how they ask for a fresh token, and the shape is
 * worth knowing rather than papering over: iOS hands you a completion to call,
 * Android notifies a listener and expects a later `updateUserJwt`. The JS
 * surface is the same on both — a listener event, then `respondToJwtExpired` —
 * so the caller never has to care which one it is on.
 *
 * This drives the same singleton `react-native-onesignal` initialises, so
 * initialisation stays there and only login/logout come through here. The token
 * is never logged, never stored and never handed back to JS.
 */
class OneSignalIdentityModule : Module() {
  private var jwtListener: IUserJwtInvalidatedListener? = null

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
      if (jwtListener == null) {
        val listener = object : IUserJwtInvalidatedListener {
          override fun onUserJwtInvalidated(event: UserJwtInvalidatedEvent) {
            sendEvent("onJwtExpired", mapOf("externalId" to event.externalId))
          }
        }
        jwtListener = listener
        OneSignal.addUserJwtInvalidatedListener(listener)
      }
    }

    OnStopObserving("onJwtExpired") {
      jwtListener?.let { OneSignal.removeUserJwtInvalidatedListener(it) }
      jwtListener = null
    }

    /**
     * Android has no completion to call, so the fresh token is pushed in
     * afterwards. Same JS contract as iOS; different mechanism underneath.
     */
    AsyncFunction("respondToJwtExpired") { externalId: String, token: String ->
      if (token.isEmpty()) throw CodedException("ERR_TOKEN", "identity token is required", null)
      OneSignal.updateUserJwt(externalId, token)
    }
  }
}
