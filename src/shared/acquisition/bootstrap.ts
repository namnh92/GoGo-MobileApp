import Constants from 'expo-constants'
import { Platform } from 'react-native'
import Tenjin from 'react-native-tenjin'

import { createTenjinInitializer } from './initialize'

const initialize = createTenjinInitializer(Tenjin, () => {
  console.warn('acquisition_sdk_unavailable')
})

export function initializeAcquisitionSdk() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return
  const key: unknown = Constants.expoConfig?.extra?.[
    Platform.OS === 'ios' ? 'tenjinIosSdkKey' : 'tenjinAndroidSdkKey'
  ]
  if (typeof key !== 'string') throw new Error('Rebuild with Tenjin environment configuration')
  initialize(key)
}
