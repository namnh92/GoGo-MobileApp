import { AppState } from 'react-native'

import { subscribeToSession, getSession } from '@/shared/api/session'

import {
  loginWithToken,
  loginWithoutToken,
  logout,
  onJwtExpired,
  respondToJwtExpired,
} from '../../../modules/onesignal-identity'
import { fetchIdentityToken } from './identity-api'
import { createIdentitySession } from './identity-session'

/**
 * NTF-APP-004 (#51) — the wiring, kept thin on purpose.
 *
 * Everything that can be decided is decided in `createIdentitySession`, which
 * is pure and tested; this file only supplies the native module, the fetch and
 * the session stream. Same split as `bootstrap.ts`.
 */
const identity = createIdentitySession({
  native: { loginWithToken, loginWithoutToken, logout, respondToJwtExpired, onJwtExpired },
  fetchToken: fetchIdentityToken,
  report: (event) => console.warn(event),
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
