import Constants from 'expo-constants'
import { Platform } from 'react-native'
import Tenjin from 'react-native-tenjin'

import { setSecureItem, getSecureItem, deleteSecureItem } from '@/shared/storage/secure-store'

import { createDeferredLinkCollector } from './deferred-link'
import { createTenjinInitializer } from './initialize'
import { createPendingDeepLinkStore } from './pending-deep-link'

const initialize = createTenjinInitializer(
  Tenjin,
  () => {
    console.warn('acquisition_sdk_unavailable')
  },
  // iOS ships through the App Store; Android through Google Play. Amazon is
  // not a target, so there is no third case to choose between.
  'googleplay',
)

/**
 * A deferred link is not a preference — a ROOM_INVITE slug *is* the invite
 * code — so it lives in secure storage, the same place the session does.
 */
export const pendingDeepLinks = createPendingDeepLinkStore({
  storage: {
    get: getSecureItem,
    set: setSecureItem,
    remove: deleteSecureItem,
  },
  report: (event) => console.warn(event),
})

const collectDeferredLink = createDeferredLinkCollector({
  sdk: Tenjin,
  store: pendingDeepLinks,
  report: (event) => console.warn(event),
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

  // After connect, because attribution is only known once the SDK has talked
  // to Tenjin. Deliberately not awaited: a launch must not wait on a provider
  // round trip, and the store is what carries the answer to whoever needs it.
  void collectDeferredLink()
}
