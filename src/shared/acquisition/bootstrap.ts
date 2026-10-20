import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { Adjust, AdjustConfig } from 'react-native-adjust'
import Tenjin from 'react-native-tenjin'

import { ADJUST_WINDOW_MS, createAdjustDeferredLinkSink } from './adjust/deferred-link'
import { adjustTokenOf, createAdjustInitializer, type AdjustSdkLike } from './adjust/initialize'
import { createDeferredLinkCollector } from './deferred-link'
import { createTenjinInitializer } from './initialize'
import { ensureInstallScope, pendingDeepLinks } from './pending-deep-links'

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

/** The one place the Adjust module is touched (ADR 0011). */
const adjustSdk: AdjustSdkLike = {
  createConfig: (token, environment) =>
    new AdjustConfig(
      token,
      environment === 'production' ? AdjustConfig.EnvironmentProduction : AdjustConfig.EnvironmentSandbox,
    ),
  initSdk: config => Adjust.initSdk(config as AdjustConfig),
}

let settled: Promise<void> = Promise.resolve()

/**
 * Whether this launch's install reset succeeded (`install-scope.ts`). False
 * until it has, and for the rest of the process when it failed: the store may
 * then hold a previous install's state, so nothing collects into it and the
 * resume does not read it. The next launch tries the reset again.
 */
let scoped = false

/**
 * Resolves once this launch's attribution reports — Tenjin's and Adjust's —
 * have been written down or given up on (both are bounded). The resume waits
 * on it, so a link reported a few seconds after sign-in is not left for the
 * next launch.
 */
export function deferredLinkSettled(): Promise<void> {
  return settled
}

/** Read after `deferredLinkSettled()`; see `scoped`. */
export function installScoped(): boolean {
  return scoped
}

/** Warns and returns on missing configuration — see the note in
 *  `shared/notifications/bootstrap.ts` (review finding F4). */
export function initializeAcquisitionSdk() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return
  // Before anything collects, and inside `settled` so the resume cannot read
  // the store first — with or without an SDK configured. `settled` always
  // resolves; a failed reset is carried by `scoped`, not by a rejection.
  const scope = ensureInstallScope().then(
    () => {
      scoped = true
    },
    () => {
      console.warn('deferred_link_install_scope_failed')
    },
  )
  const tenjin = startTenjin(scope)
  const adjust = startAdjust(scope)
  settled = Promise.all([tenjin, adjust]).then(() => undefined)
}

function startTenjin(scope: Promise<void>): Promise<void> {
  const key: unknown = Constants.expoConfig?.extra?.[
    Platform.OS === 'ios' ? 'tenjinIosSdkKey' : 'tenjinAndroidSdkKey'
  ]
  if (typeof key !== 'string' || key.length === 0) {
    console.warn('acquisition_sdk_unavailable: rebuild with Tenjin environment configuration')
    return scope
  }
  initialize(key)

  // After connect, because attribution is only known once the SDK has talked
  // to Tenjin. Deliberately not awaited: a launch must not wait on a provider
  // round trip, and the store is what carries the answer to whoever needs it.
  // Only into a store the reset has cleared.
  return scope.then(() => (scoped ? collectDeferredLink() : undefined)).catch(() => {})
}

/**
 * GoGo-MobileApp#367 — Adjust starts after the install reset, so its deferred
 * link can only land in a store that belongs to this install, and whatever
 * happens its sink settles: answered, window over, or not running.
 */
let adjustStart: Promise<void> | undefined

function startAdjust(scope: Promise<void>): Promise<void> {
  // Once per process: a second bootstrap (a remounted provider) gets the
  // first one's answer instead of a second SDK start.
  adjustStart ??= runAdjust(scope)
  return adjustStart
}

function runAdjust(scope: Promise<void>): Promise<void> {
  const raw: unknown = Constants.expoConfig?.extra?.[
    Platform.OS === 'ios' ? 'adjustIosAppToken' : 'adjustAndroidAppToken'
  ]
  return scope
    .then(() => {
      const sink = createAdjustDeferredLinkSink({
        store: pendingDeepLinks,
        windowMs: Platform.OS === 'ios' ? ADJUST_WINDOW_MS.ios : ADJUST_WINDOW_MS.android,
        report: event => console.warn(event),
      })
      const token = adjustTokenOf(raw)
      if (!scoped) sink.skip('acquisition_adjust_skipped:install_scope_failed')
      else if (raw === 'off') sink.skip('acquisition_adjust_off')
      else if (!token) sink.skip('acquisition_adjust_unavailable: rebuild with Adjust environment configuration')
      else {
        const initializeAdjust = createAdjustInitializer({
          sdk: adjustSdk,
          flavor: Constants.expoConfig?.extra?.flavor,
          onDeferredLink: payload => sink.onDeferredLink(payload),
          onAttribution: () => sink.onAttribution(),
          onUnavailable: event => console.warn(event),
        })
        if (!initializeAdjust(token)) sink.skip('acquisition_adjust_unavailable')
      }
      return sink.settled()
    })
    .catch(() => {})
}
