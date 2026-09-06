import { requireNativeModule } from 'expo-modules-core'
import type { EventSubscription } from 'expo-modules-core'

/**
 * NTF-APP-004 (#51) — the identity-verified half of OneSignal login.
 *
 * `react-native-onesignal` 5.5.9 exposes `login(externalId)` and nothing else.
 * Its native SDKs — OneSignalXCFramework 5.5.6 and com.onesignal 5.9.9, both
 * already in this binary — take a token, so identity verification is supported
 * by the SDK and simply absent from the JS surface. This module is that
 * surface. Initialisation still belongs to `react-native-onesignal`; only
 * login, logout and the token-expiry callback come through here.
 */
interface OneSignalIdentityNativeModule {
  loginWithToken(externalId: string, token: string): Promise<void>
  loginWithoutToken(externalId: string): Promise<void>
  logout(): Promise<void>
  respondToJwtExpired(externalId: string, token: string): Promise<void>
  addListener(event: 'onJwtExpired', listener: (payload: { externalId: string }) => void): EventSubscription
}

const native = requireNativeModule<OneSignalIdentityNativeModule>('OneSignalIdentity')

/** Bind this device's subscription to `externalId`, proving who it is. */
export function loginWithToken(externalId: string, token: string): Promise<void> {
  return native.loginWithToken(externalId, token)
}

/**
 * Login with no proof. Only for an environment holding no signing key, and
 * named so a reader can tell the two apart at the call site rather than by
 * inspecting an argument.
 */
export function loginWithoutToken(externalId: string): Promise<void> {
  return native.loginWithoutToken(externalId)
}

export function logout(): Promise<void> {
  return native.logout()
}

/**
 * The SDK asks for a fresh token when the one it holds expires or is refused.
 * Answer with `respondToJwtExpired`; until then the SDK holds the request open,
 * which is a retry rather than a silent logout.
 */
export function onJwtExpired(
  handler: (externalId: string) => void,
): EventSubscription {
  return native.addListener('onJwtExpired', ({ externalId }) => handler(externalId))
}

export function respondToJwtExpired(externalId: string, token: string): Promise<void> {
  return native.respondToJwtExpired(externalId, token)
}
