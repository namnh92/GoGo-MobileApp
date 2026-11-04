import { AppState, Platform } from 'react-native'
import { OneSignal } from 'react-native-onesignal'

import { registerPushSubscription } from '@/shared/api/endpoints/me'
import { subscribeToSession, getSession, hydrateSession } from '@/shared/api/session'

import {
  loginWithToken,
  loginWithoutToken,
  logout,
  onJwtExpired,
  respondToJwtExpired,
} from '../../../modules/onesignal-identity'
import { createDeviceCredentialStore, secureDeviceCredentialStorage } from './device-credential-store'
import {
  createDeviceIdentity,
  renewDeviceToken,
  reportDeviceSubscription,
  retireDeviceIdentity,
} from './device-identity-api'
import { devicePromotionsStore } from './device-promotions-store'
import { fetchIdentityToken } from './identity-api'
import { createIdentityConfirmation, createLoginSettlement } from './identity-confirmation'
import { createIdentitySession } from './identity-session'
import { unsubscribeCurrentDeviceAndConfirm } from './logout-confirmation-bootstrap'

/**
 * NTF-APP-004 (#51) — the wiring, kept thin on purpose.
 *
 * Everything that can be decided is decided in `createIdentitySession`, which
 * is pure and tested; this file only supplies the native module, the fetch and
 * the session stream. Same split as `bootstrap.ts`.
 */
const report = (event: string) => console.warn(event)

const readIdentity = {
  getExternalId: () => OneSignal.User.getExternalId(),
  getOnesignalId: () => OneSignal.User.getOnesignalId(),
}

const pushPlatform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null

export const pushIdentity = createIdentitySession({
  native: { loginWithToken, loginWithoutToken, logout, respondToJwtExpired, onJwtExpired },
  fetchToken: fetchIdentityToken,
  report,

  // NTF-APP-004 (#161). `login()` returning is not the provider accepting it:
  // under Identity Verification a refused JWT leaves a `local-` id behind and
  // looks like success. Read both values, as OneSignal's own guidance says.
  confirmIdentity: createIdentityConfirmation({ reader: readIdentity, report }),

  // Bounded by the same 15 s. Whether or not this login is still wanted, the next
  // transition waits for the SDK to finish it (M-3, shape §8.1).
  settleNative: createLoginSettlement({ reader: readIdentity }),

  confirmSignOut: unsubscribeCurrentDeviceAndConfirm,

  /**
   * What the OS already permits — never what we could ask it for.
   *
   * This is read, not requested: a login must not spend the one notification
   * prompt the app gets. The prompt belongs to a screen where the person asked
   * for notifications, not to the moment they typed a password.
   *
   * The app's own notification preferences are a separate gate, and a different
   * kind of one: they are per notification type, they live on the server, and
   * they are applied when something is sent. They do not say whether this device
   * may hold a subscription at all, so they have no business here — the only
   * question at this point is whether the OS permits notifications.
   */
  eligible: () => OneSignal.Notifications.getPermissionAsync(),

  optIn: () => {
    OneSignal.User.pushSubscription.optIn()
  },

  /**
   * NTF-APP-008 (#171) — the API learns this device can be reached.
   *
   * Reached only after identity is confirmed, the OS permits notifications and
   * the device is opted in, so what is reported is a subscription that exists
   * rather than an intention to have one. The server verifies the id against
   * the provider before recording it, so a wrong or stale id is refused rather
   * than believed.
   *
   * `web` is in the contract for the PWA; this build is only ever ios or
   * android, and anything else is a platform this file has not been taught
   * about — better to report nothing than to guess.
   */
  reportSubscription: async () => {
    const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync()
    if (!subscriptionId) {
      report('push_subscription_id_missing')
      return
    }
    if (!pushPlatform) {
      report('push_subscription_platform_unsupported')
      return
    }
    await registerPushSubscription({ platform: pushPlatform, subscriptionId })
  },

  /** NTF-APP-011 (#398): a device with no user session. Every decision is in the session. */
  device: {
    credentials: createDeviceCredentialStore(secureDeviceCredentialStorage),
    promotions: devicePromotionsStore,
    create: createDeviceIdentity,
    renew: renewDeviceToken,
    submit: reportDeviceSubscription,
    retire: retireDeviceIdentity,
    optOut: () => {
      OneSignal.User.pushSubscription.optOut()
    },
    getSubscriptionId: () => OneSignal.User.pushSubscription.getIdAsync(),
    getNativeExternalId: () => OneSignal.User.getExternalId(),
    platform: pushPlatform,
  },
  // Identity is verified or it does not happen. An environment with no signing
  // key leaves the device unbound, which is honest; an unverified login would
  // be a weaker guarantee wearing the same name.
  allowUnverified: false,
})

export function initializePushIdentity(): () => void {
  pushIdentity.start()
  // Apply once for a session that hydrated before this ran, then follow.
  void hydrateSession().finally(() => void pushIdentity.apply(getSession()))
  const unsubscribe = subscribeToSession((session) => {
    void pushIdentity.apply(session)
  })

  // Coming back to the foreground is the retry moment. If the token was being
  // refused because of a provider misconfiguration, the fix happens elsewhere
  // — in a dashboard — while this app keeps running, and without this it would
  // stay unbound until the next login. Rare enough that it cannot rebuild the
  // loop the budget exists to stop.
  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') {
      pushIdentity.resetRefreshBudget()
      void pushIdentity.retryPending()
    }
  })

  return () => {
    unsubscribe()
    appState.remove()
    pushIdentity.stop()
  }
}
