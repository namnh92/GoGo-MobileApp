import { OneSignal } from 'react-native-onesignal'

import { pushIdentity } from './identity-bootstrap'
import { createPushPermission } from './permission'

/**
 * NTF-APP-003 (#50) — the wiring, kept thin. Every decision lives in
 * `createPushPermission`, which is pure and tested; this only supplies the SDK.
 */
export const pushPermission = createPushPermission({
  sdk: {
    hasPermission: () => OneSignal.Notifications.getPermissionAsync(),
    canRequestPermission: () => OneSignal.Notifications.canRequestPermission(),
    requestPermission: (fallbackToSettings: boolean) =>
      OneSignal.Notifications.requestPermission(fallbackToSettings),
  },
  report: (event) => console.warn(event),
  // Granted is not subscribed: the coordinator re-runs what waited on permission,
  // for the user or the device identity it holds (#398 F-05).
  resume: () => void pushIdentity.retryPending(),
})
