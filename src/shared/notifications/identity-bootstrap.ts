import { AppState } from 'react-native'
import { OneSignal } from 'react-native-onesignal'

import { subscribeToSession, getSession } from '@/shared/api/session'

import {
  loginWithToken,
  loginWithoutToken,
  logout,
  onJwtExpired,
  respondToJwtExpired,
} from '../../../modules/onesignal-identity'
import { fetchIdentityToken } from './identity-api'
import { createIdentityConfirmation } from './identity-confirmation'
import { createIdentitySession } from './identity-session'

/**
 * NTF-APP-004 (#51) — the wiring, kept thin on purpose.
 *
 * Everything that can be decided is decided in `createIdentitySession`, which
 * is pure and tested; this file only supplies the native module, the fetch and
 * the session stream. Same split as `bootstrap.ts`.
 */
const report = (event: string) => console.warn(event)

const identity = createIdentitySession({
  native: { loginWithToken, loginWithoutToken, logout, respondToJwtExpired, onJwtExpired },
  fetchToken: fetchIdentityToken,
  report,

  // NTF-APP-004 (#161). `login()` returning is not the provider accepting it:
  // under Identity Verification a refused JWT leaves a `local-` id behind and
  // looks like success. Read both values, as OneSignal's own guidance says.
  confirmIdentity: createIdentityConfirmation({
    reader: {
      getExternalId: () => OneSignal.User.getExternalId(),
      getOnesignalId: () => OneSignal.User.getOnesignalId(),
    },
    report,
  }),

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
  // Identity is verified or it does not happen. An environment with no signing
  // key leaves the device unbound, which is honest; an unverified login would
  // be a weaker guarantee wearing the same name.
  allowUnverified: false,
})

export function initializePushIdentity(): () => void {
  identity.start()
  // Apply once for a session that hydrated before this ran, then follow.
  void identity.apply(getSession())
  const unsubscribe = subscribeToSession((session) => {
    void identity.apply(session)
  })

  // Coming back to the foreground is the retry moment. If the token was being
  // refused because of a provider misconfiguration, the fix happens elsewhere
  // — in a dashboard — while this app keeps running, and without this it would
  // stay unbound until the next login. Rare enough that it cannot rebuild the
  // loop the budget exists to stop.
  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') identity.resetRefreshBudget()
  })

  return () => {
    unsubscribe()
    appState.remove()
    identity.stop()
  }
}
