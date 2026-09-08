import Constants from 'expo-constants'
import { Platform } from 'react-native'
import Tenjin from 'react-native-tenjin'

import { createTenjinInitializer } from './initialize'

const initialize = createTenjinInitializer(Tenjin, () => {
  console.warn('acquisition_sdk_unavailable')
})

/** Warns and returns on missing configuration — see the note in
 *  `shared/notifications/bootstrap.ts` (review finding F4). */
export function initializeAcquisitionSdk() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return
  const key: unknown = Constants.expoConfig?.extra?.[
    Platform.OS === 'ios' ? 'tenjinIosSdkKey' : 'tenjinAndroidSdkKey'
  ]
  if (typeof key !== 'string' || key.length === 0) {
    console.warn('acquisition_sdk_unavailable: rebuild with Tenjin environment configuration')
    return
  }
  initialize(key)
}
