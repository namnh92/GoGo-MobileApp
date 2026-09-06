import Constants from 'expo-constants'
import { OneSignal } from 'react-native-onesignal'

import { createOneSignalInitializer } from './initialize'

const initialize = createOneSignalInitializer(OneSignal, () => {
  console.warn('push_sdk_unavailable')
})

/**
 * Missing configuration warns and returns rather than throwing (review finding
 * F4). `app.config.ts` refuses to build without these values, so this is
 * unreachable through the documented path — but it *is* reachable from a Dev
 * Client pointed at a packager whose environment lacks them, and there the old
 * behaviour killed the app from inside a useEffect with no error boundary
 * above it. A provider that cannot start must not take the app down with it;
 * that is the rule the initializer below already follows, and the caller was
 * the one place breaking it.
 */
export function initializePushSdk() {
  const appId: unknown = Constants.expoConfig?.extra?.oneSignalAppId
  if (typeof appId !== 'string' || appId.length === 0) {
    console.warn('push_sdk_unavailable: rebuild with OneSignal environment configuration')
    return
  }
  initialize(appId)
}
