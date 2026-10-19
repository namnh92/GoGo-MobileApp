import Constants from 'expo-constants'
import { Platform } from 'react-native'
import Tenjin from 'react-native-tenjin'

import { createDeferredLinkCollector } from './deferred-link'
import { createTenjinInitializer } from './initialize'
import { pendingDeepLinks } from './pending-deep-links'

export { pendingDeepLinks }

const initialize = createTenjinInitializer(
  Tenjin,
  () => {
    console.warn('acquisition_sdk_unavailable')
  },
  // iOS ships through the App Store; Android through Google Play. Amazon is
  // not a target, so there is no third case to choose between.
  'googleplay',
)

const collectDeferredLink = createDeferredLinkCollector({
  sdk: Tenjin,
  store: pendingDeepLinks,
  report: (event) => console.warn(event),
})

let settled: Promise<void> = Promise.resolve()

/**
 * Resolves once this launch's attribution report has been written down or
 * given up on (the collector is bounded). The resume waits on it, so a link
 * reported a few seconds after sign-in is not left for the next launch.
 */
export function deferredLinkSettled(): Promise<void> {
  return settled
}

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
  settled = collectDeferredLink().catch(() => {})
}
