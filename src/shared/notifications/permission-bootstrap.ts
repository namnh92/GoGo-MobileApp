import { OneSignal } from 'react-native-onesignal'

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
    optIn: () => OneSignal.User.pushSubscription.optIn(),
  },
  report: (event) => console.warn(event),
})
