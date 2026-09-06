import Constants from 'expo-constants'
import { OneSignal } from 'react-native-onesignal'

import { createOneSignalInitializer } from './initialize'

const initialize = createOneSignalInitializer(OneSignal, () => {
  console.warn('push_sdk_unavailable')
})

export function initializePushSdk() {
  const appId: unknown = Constants.expoConfig?.extra?.oneSignalAppId
  if (typeof appId !== 'string') throw new Error('Rebuild with OneSignal environment configuration')
  initialize(appId)
}
