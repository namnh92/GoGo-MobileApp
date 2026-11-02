import Constants from 'expo-constants'
import { NativeModules, Platform } from 'react-native'
import type * as AdjustModule from 'react-native-adjust'
import Tenjin from 'react-native-tenjin'

import { ADJUST_WINDOW_MS, createAdjustDeferredLinkSink, type AdjustDeferredLinkSink } from './adjust/deferred-link'
import { adjustTokenOf, createAdjustInitializer, type AdjustSdkLike } from './adjust/initialize'
import { adjustNativeAvailable } from './adjust/native-preflight'
import { createOwnLinkCheck } from './adjust/own-link'
import { consentStore } from '@/shared/consent/consent-store'
import { trackingConsent } from '@/shared/consent/tracking'

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
  Platform.OS === 'android',
)

const collectDeferredLink = createDeferredLinkCollector({
  sdk: Tenjin,
  store: pendingDeepLinks,
  report: (event) => console.warn(event),
})

/**
 * The one place the Adjust module is touched (ADR 0011) — loaded only when this
 * launch will start it, and only after `native-preflight.ts` has seen the
 * native modules the wrapper reads while it is evaluated. A wrapper whose
 * native side is missing throws from its module factory, and Metro reports
 * that as fatal before the `catch` below could run (PR #369 Astra F-01), so a
 * build without them never evaluates the wrapper: Adjust is unavailable, the
 * launch is not.
 */
async function loadAdjustSdk(): Promise<AdjustRuntime | undefined> {
  if (!adjustNativeAvailable(Platform.OS, NativeModules)) {
    console.warn('acquisition_adjust_unavailable:native_missing')
    return undefined
  }
  const { Adjust, AdjustConfig }: typeof AdjustModule = await import('react-native-adjust')
  return {
    createConfig: (token, environment) =>
      new AdjustConfig(
        token,
        environment === 'production' ? AdjustConfig.EnvironmentProduction : AdjustConfig.EnvironmentSandbox,
      ),
    initSdk: config => Adjust.initSdk(config as AdjustModule.AdjustConfig),
    enable: () => Adjust.enable(),
    disable: () => Adjust.disable(),
  }
}

/** What a start may use, plus the switch only Android's Settings row needs (#370). */
type AdjustRuntime = AdjustSdkLike & { enable(): void; disable(): void }

/** A start's authority: false once the consent it began under is no longer current. */
type StartGuard = () => boolean
const alwaysCurrent: StartGuard = () => true

/** Set while Adjust's launch window is open; closed when Tenjin has already won. */
let adjustSink: AdjustDeferredLinkSink | undefined

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
  if (Platform.OS === 'android') {
    // #370: nothing reaches a vendor before the person's answer.
    androidChain ??= runAndroid()
    settled = androidChain
    return
  }
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

function startTenjin(scope: Promise<void>, current: StartGuard = alwaysCurrent): Promise<void> {
  const key: unknown = Constants.expoConfig?.extra?.[
    Platform.OS === 'ios' ? 'tenjinIosSdkKey' : 'tenjinAndroidSdkKey'
  ]
  if (typeof key !== 'string' || key.length === 0) {
    console.warn('acquisition_sdk_unavailable: rebuild with Tenjin environment configuration')
    return scope
  }
  if (!current()) {
    console.warn('acquisition_start_stale:tenjin')
    return scope
  }
  android.tenjinStarted = true
  initialize(key)

  // After connect, because attribution is only known once the SDK has talked
  // to Tenjin. Deliberately not awaited: a launch must not wait on a provider
  // round trip, and the store is what carries the answer to whoever needs it.
  // Only into a store the reset has cleared. When Tenjin's report wins, the
  // Adjust window has nothing left to decide (PR #369 Astra F-03).
  return scope
    .then(() => (scoped && current() ? collectDeferredLink() : undefined))
    .then(() => closeAdjustIfWon())
    .catch(() => {})
}

async function closeAdjustIfWon(): Promise<void> {
  if (adjustSink && (await pendingDeepLinks.hasPending())) {
    adjustSink.skip('acquisition_adjust_closed:link_already_pending')
  }
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

function runAdjust(
  scope: Promise<void>,
  current: StartGuard = alwaysCurrent,
  onStarted?: (sdk: AdjustRuntime) => void,
): Promise<void> {
  const raw: unknown = Constants.expoConfig?.extra?.[
    Platform.OS === 'ios' ? 'adjustIosAppToken' : 'adjustAndroidAppToken'
  ]
  return scope
    .then(() => {
      const sink = createAdjustDeferredLinkSink({
        store: pendingDeepLinks,
        windowMs: Platform.OS === 'ios' ? ADJUST_WINDOW_MS.ios : ADJUST_WINDOW_MS.android,
        isOwnLink: createOwnLinkCheck({
          scheme: Constants.expoConfig?.scheme,
          webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL,
        }),
        report: event => console.warn(event),
      })
      adjustSink = sink
      // Whenever another writer's link is kept — Tenjin's callback included,
      // even one that lands after its collector gave up (PR #369 Astra F-03) —
      // the window has nothing left to decide. Adjust's own write finds the
      // sink already closed. Plus the check below for a link kept before this
      // sink existed.
      const unsubscribe = pendingDeepLinks.onStored(() => sink.skip('acquisition_adjust_closed:link_already_pending'))
      void sink.settled().then(unsubscribe)
      void closeAdjustIfWon()
      const token = adjustTokenOf(raw)
      if (!scoped) sink.skip('acquisition_adjust_skipped:install_scope_failed')
      else if (raw === 'off') sink.skip('acquisition_adjust_off')
      else if (!token) sink.skip('acquisition_adjust_unavailable: rebuild with Adjust environment configuration')
      // Not awaited: the sink settles on its own events — window end, another
      // writer, a link — and the SDK's loading must not hold the resume
      // (PR #369 Astra F-06). A load or init that fails closes the sink too.
      else if (!current()) retireAdjustStart(sink)
      else void startAdjustSdk(token, sink, current, onStarted)
      return sink.settled()
    })
    .catch(() => {})
}

/**
 * Loads and starts the SDK; never rejects. Started even when the sink has
 * already closed, because Adjust is this launch's attribution report (ADR 0011)
 * whatever the deferred link decided — a later report is `…ignored:late`.
 */
async function startAdjustSdk(
  token: string,
  sink: AdjustDeferredLinkSink,
  current: StartGuard,
  onStarted?: (sdk: AdjustRuntime) => void,
): Promise<void> {
  let sdk: AdjustRuntime | undefined
  try {
    sdk = await loadAdjustSdk()
  } catch {
    sdk = undefined
  }
  if (!sdk) {
    sink.skip('acquisition_adjust_unavailable')
    return
  }
  // The import can outlast a change of mind (#370, shape D3): checked after it,
  // and nothing awaits between here and `initSdk`.
  if (!current()) {
    retireAdjustStart(sink)
    return
  }
  const initializeAdjust = createAdjustInitializer({
    sdk,
    flavor: Constants.expoConfig?.extra?.flavor,
    onDeferredLink: payload => sink.onDeferredLink(payload),
    onAttribution: () => sink.onAttribution(),
    onUnavailable: event => console.warn(event),
  })
  if (!initializeAdjust(token)) sink.skip('acquisition_adjust_unavailable')
  else onStarted?.(sdk)
}

/** Said on its own: the withdrawal may already have closed this sink. */
function retireAdjustStart(sink: AdjustDeferredLinkSink): void {
  console.warn('acquisition_start_stale:adjust')
  sink.skip('acquisition_adjust_skipped:start_stale')
}

/**
 * GoGo-MobileApp#370 (MMP-APP-004, ADR 0013, shape D3–D5) — Android asks first.
 * iOS keeps its order above: ATT is the consent there (owner Q5, 2026-11-02).
 *
 *   - **nothing before `granted`.** Not `initialize`, not `connect`, not
 *     `initSdk`: the install reset runs at launch, everything that talks to a
 *     vendor waits for a stored answer, the sheet, or the Settings switch;
 *   - **the windows start at the answer.** Sink and collector run after it, or
 *     they would close before a late answer could start the SDKs;
 *   - **every start re-checks.** A withdrawal during the reset or the lazy import
 *     retires the start that was waiting on them (`current`);
 *   - **withdrawal is runtime first.** The write is issued and the SDKs stopped
 *     in one tick, whatever the disk does;
 *   - **bounded.** A storage call that never answers cannot hold the resume
 *     past `ACQUISITION_SETTLE_TIMEOUT_MS` from the decision.
 */
const android: {
  tenjinStarted: boolean
  adjust?: AdjustRuntime
  applied?: { generation: number; done: Promise<void> }
} = { tenjinStarted: false }

/** A healthy reset takes far less; Android's secure store is the slow part. */
export const INSTALL_SCOPE_TIMEOUT_MS = 5_000

/** The reset bound, the Android Adjust window, and a margin. */
export const ACQUISITION_SETTLE_TIMEOUT_MS = 20_000

let androidChain: Promise<void> | undefined
let androidScope: Promise<void> | undefined
/** Once the settle gave up, a late completion authorises nothing this launch. */
let scopeRetired = false

/** Resolves always; `scoped` only turns true for a reset inside its deadline. */
function ensureAndroidScope(): Promise<void> {
  androidScope ??= new Promise<void>(resolve => {
    let late = false
    const timer = setTimeout(() => {
      late = true
      console.warn('deferred_link_install_scope_timed_out')
      resolve()
    }, INSTALL_SCOPE_TIMEOUT_MS)
    ensureInstallScope().then(
      () => {
        clearTimeout(timer)
        if (!late && !scopeRetired) scoped = true
        resolve()
      },
      () => {
        clearTimeout(timer)
        console.warn('deferred_link_install_scope_failed')
        resolve()
      },
    )
  })
  return androidScope
}

async function runAndroid(): Promise<void> {
  ensureAndroidScope()
  // A stored answer settles this at once; otherwise the gate's sheet does.
  await trackingConsent.status()
  await trackingConsent.settled()
  await boundedSettle(applyAndroidConsent())
}

function boundedSettle(chain: Promise<void>): Promise<void> {
  return new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      scopeRetired = true
      scoped = false
      console.warn('acquisition_settle_timed_out')
      resolve()
    }, ACQUISITION_SETTLE_TIMEOUT_MS)
    void chain.finally(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/** Vendor calls never throw into a launch or a switch. */
function vendor(call: () => void): void {
  try {
    call()
  } catch {
    console.warn('acquisition_vendor_call_failed')
  }
}

/** Brings the SDKs in line with the current answer, once per change of mind. */
function applyAndroidConsent(): Promise<void> {
  const generation = consentStore.generation()
  if (android.applied?.generation === generation) return android.applied.done
  const value = consentStore.get()
  const done = value === 'granted' ? startAndroidSdks(generation) : stopAndroidSdks(value === 'denied')
  android.applied = { generation, done }
  return done
}

function startAndroidSdks(generation: number): Promise<void> {
  const current: StartGuard = () => consentStore.get() === 'granted' && consentStore.generation() === generation
  const scope = ensureAndroidScope()
  let tenjin: Promise<void> = Promise.resolve()
  if (android.tenjinStarted) vendor(() => Tenjin.optIn())
  else tenjin = startTenjin(scope, current)
  let adjust: Promise<void> = Promise.resolve()
  const started = android.adjust
  if (started) vendor(() => started.enable())
  else {
    adjust = runAdjust(scope, current, sdk => {
      android.adjust = sdk
      // `disable()` outlives a launch: without this a past "off" leaves the SDK
      // silent while the app believes it runs.
      vendor(() => sdk.enable())
    })
  }
  return Promise.all([tenjin, adjust]).then(() => undefined)
}

function stopAndroidSdks(denied: boolean): Promise<void> {
  const reason = denied ? 'consent_denied' : 'consent_later'
  if (android.tenjinStarted) vendor(() => Tenjin.optOut())
  else console.warn(`acquisition_skipped:${reason}`)
  const started = android.adjust
  if (started) vendor(() => started.disable())
  else console.warn(`acquisition_adjust_skipped:${reason}`)
  // A window still open has nothing left to decide.
  adjustSink?.skip(`acquisition_adjust_skipped:${reason}`)
  return Promise.resolve()
}

/**
 * The Settings switch (#370, shape D5). The answer's write is issued before the
 * SDKs are told: same tick, so the window is the storage latency, not theirs.
 */
export function setAcquisitionConsent(granted: boolean): void {
  if (Platform.OS !== 'android') return
  console.warn(`consent_tracking:settings:${granted ? 'on' : 'off'}`)
  trackingConsent.answer(granted ? 'granted' : 'denied')
  void applyAndroidConsent()
}

/** Whether this build has anything the switch could start. */
export function acquisitionConfigured(): boolean {
  const extra = Constants.expoConfig?.extra
  const tenjin: unknown = extra?.tenjinAndroidSdkKey
  return (typeof tenjin === 'string' && tenjin.length > 0) || adjustTokenOf(extra?.adjustAndroidAppToken) !== null
}
