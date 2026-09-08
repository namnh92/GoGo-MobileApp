import { OneSignal } from 'react-native-onesignal'

import { api } from '@/shared/api/client'
import type { OpResponse } from '@/shared/api/types'

import { logout as nativeLogout } from '../../../modules/onesignal-identity'
import { createLogoutConfirmation } from './logout-confirmation'

/**
 * NTF-APP-004 (#160) — the wiring, kept thin. Every decision lives in
 * `createLogoutConfirmation`, which is pure and tested; this only supplies the
 * SDK and the endpoint. Same split as `identity-bootstrap.ts` beside it, and
 * for the same reason: the pure half must not import React Native.
 */

/** `POST /v1/notifications/identity/logout` — read-only, caller-scoped. */
export async function confirmUnsubscribed(subscriptionId: string): Promise<boolean> {
  const body = await api.post<OpResponse<'confirmDeviceUnsubscribed'>>(
    '/notifications/identity/logout',
    { subscriptionId },
  )
  return body.confirmed
}

export const unsubscribeCurrentDeviceAndConfirm = createLogoutConfirmation({
  unsubscribe: nativeLogout,
  getSubscriptionId: () => OneSignal.User.pushSubscription.getIdAsync(),
  confirm: confirmUnsubscribed,
  report: (event) => console.warn(event),
})
