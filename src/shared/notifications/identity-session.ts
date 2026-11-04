/**
 * NTF-APP-004 (#51) — bind the push subscription to the signed-in user, and
 * prove it. NTF-APP-011 (#398) — and give a device with no user session its own
 * identity, for GoGo-wide promotions only (ADR-0038, shape D3).
 *
 * Pure and injectable: the native module, the token fetch and the logger all
 * arrive as arguments, so every branch below is testable without a device.
 * `bootstrap.ts` is the only place that supplies the real ones.
 *
 * Three rules the shape encodes:
 *
 *   - a `user` session logs in, anything else leaves the user. A guest session
 *     is room-scoped and is not a person; binding a subscription to one would
 *     attach a device to a session id. With no user session the device holds a
 *     `device:<id>` identity, once the person has accepted the disclosure;
 *   - the same user id is never logged in twice. Re-running is a no-op, so a
 *     session refresh — which changes the access token and not the person —
 *     does not churn the provider;
 *   - identity is verified or it does not happen. When the environment holds
 *     no signing key the endpoint answers 503, and the default is to leave the
 *     device unbound rather than fall back to an unverified login. Falling back
 *     is possible but has to be asked for by name.
 *
 * One coordinator owns every native mutation (shape D3). Transitions run one at
 * a time, and each change of target bumps `generation`; every asynchronous
 * continuation re-checks it before each side effect, so A -> B -> A is three
 * generations, not an equality test.
 */
import type { DeviceCredential, DeviceCredentialStore } from './device-credential-store'
import type {
  DeviceCreateOutcome,
  DeviceRenewOutcome,
  DeviceReportOutcome,
  DeviceRetireOutcome,
  DeviceSubscriptionReport,
} from './device-identity-api'
import type { DevicePromotionsStore, DisclosureAnswer } from './device-promotions-store'

export type IdentityToken = { externalId: string; token: string; expiresAt: string }

export interface OneSignalIdentity {
  loginWithToken(externalId: string, token: string): Promise<void>
  loginWithoutToken(externalId: string): Promise<void>
  logout(): Promise<void>
  respondToJwtExpired(externalId: string, token: string): Promise<void>
  onJwtExpired(handler: (externalId: string) => void): { remove(): void }
}

export type IdentityFetchOutcome =
  | { kind: 'ok'; token: IdentityToken }
  /** 503 PUSH_IDENTITY_UNAVAILABLE — no signing key in this environment. */
  | { kind: 'unavailable' }
  /** 401/403, or a network failure. Worth retrying on the next session change. */
  | { kind: 'error' }

/**
 * Whether this device may hold a push subscription right now. Supplied by the
 * caller and **defaults to refusing**: a slice that has not wired permission
 * and preference must not opt anyone in, and failing closed is the only safe
 * default for a decision about someone's notifications.
 */
export type OptInEligibility = () => Promise<boolean>

export type ConfirmIdentity = (
  externalId: string,
  isCurrent: () => boolean,
) => Promise<{ kind: string }>

export type IdentitySessionDeps = {
  native: OneSignalIdentity
  fetchToken: () => Promise<IdentityFetchOutcome>
  /**
   * Waits until the SDK agrees the device belongs to this user. Optional so
   * existing callers keep their behaviour; without it nothing is opted in,
   * which is the same fail-closed default as `eligible`.
   */
  confirmIdentity?: ConfirmIdentity
  /** Called only after identity is confirmed, and only if this answers true. */
  eligible?: OptInEligibility
  /** Opting this device back in. Never called without confirmation. */
  optIn?: () => void
  /**
   * NTF-APP-008 (#171) — tells the API this device holds a live push
   * subscription for this user, once that is actually true.
   *
   * Optional and best-effort. It is the last step of the ordered flow, never a
   * precondition of any earlier one: a failure here must not unbind a device or
   * break a login, so it is reported and dropped.
   *
   * The server is what a campaign audience is resolved from (GoGo-BE#515). It
   * used to be resolved from a `device_tokens` table nothing wrote to, so real
   * users were in no audience at all and three contract-test accounts were the
   * whole of one.
   */
  reportSubscription?: (userId: string) => Promise<void>
  /**
   * #160 inside the sign-out transition (R-21). Throws when the provider did not
   * confirm; the coordinator re-binds only when the caller says `cancelSignOut`.
   */
  confirmSignOut?: () => Promise<void>
  /**
   * Waits for the SDK to finish this login before the next transition may start,
   * whether or not it is still wanted. Bounded by the implementation. M-3: rapid
   * transitions on iOS left stray subscriptions (shape §8.1).
   */
  settleNative?: (externalId: string) => Promise<void>
  /** Absent: this build has no device half, and no session means no identity. */
  device?: DeviceIdentityDeps
  /** Reason codes only. Never a token, never a user id. */
  report?: (event: string) => void
  /**
   * Only for an environment that deliberately runs without identity
   * verification. Off by default: an unverified login is a weaker guarantee
   * wearing the same name, and it must be a decision, not a fallback.
   */
  allowUnverified?: boolean
}

export type IdentitySession = { kind: 'user' | 'guest'; userId?: string | undefined } | null

export type DeviceIdentityDeps = {
  credentials: DeviceCredentialStore
  promotions: DevicePromotionsStore
  create: () => Promise<DeviceCreateOutcome>
  renew: (credential: DeviceCredential) => Promise<DeviceRenewOutcome>
  submit: (credential: DeviceCredential, body: DeviceSubscriptionReport) => Promise<DeviceReportOutcome>
  retire: (credential: DeviceCredential) => Promise<DeviceRetireOutcome>
  optOut: () => void
  getSubscriptionId: () => Promise<string | null>
  /** Who the SDK says it is right now: what a previous launch may have left. */
  getNativeExternalId: () => Promise<string | null>
  platform: DeviceSubscriptionReport['platform'] | null
  sleep?: (ms: number) => Promise<void>
}

/** Waits between reports while the provider catches up with an opt-in or opt-out. */
export const DEVICE_REPORT_BACKOFF_MS = [2_000, 5_000, 15_000]
/** `PUSH_SUBSCRIPTION_CONFLICT`: nothing was written; report again this many times. */
export const MAX_DEVICE_REPORT_CONFLICTS = 2
/** A server that keeps saying GONE about identities it just issued. */
export const MAX_DEVICE_RECREATES = 1

const DEVICE_PREFIX = 'device:'

type Target = { kind: 'user'; userId: string } | { kind: 'device' }

type Binding =
  | { kind: 'none' }
  | { kind: 'user'; userId: string; externalId: string }
  | { kind: 'device'; externalId: string; credential: DeviceCredential }

/** What happens after a login: confirm, opt in or out, tell the API. */
type Flow = { id: number; generation: number; state: 'running' | 'done' | 'retry' }

/**
 * How many times in a row a refused token is replaced before giving up.
 *
 * Observed on the DEV emulator, 2026-09-07: OneSignal answered 401 to a
 * correctly-signed ES256 token, invalidated it, and asked for another. The
 * handler minted one with the same key, which was refused identically — a loop
 * firing every ~5.8 seconds for as long as the app stayed open, one call to
 * GET /v1/notifications/identity each time.
 *
 * The point is that this failure is not transient. If the provider refuses a
 * freshly-signed token, the next one signed with the same key is refused too;
 * the environment is misconfigured and only a person can fix it. Retrying
 * forever burns battery, hammers the API and — worst — hides the fault behind
 * activity. Three attempts, then stop and say so.
 *
 * The counter resets whenever a bind succeeds or the user changes, so a
 * genuinely expired token later in a long session still refreshes normally.
 */
export const MAX_CONSECUTIVE_JWT_REFRESHES = 3

export function createIdentitySession(deps: IdentitySessionDeps) {
  const report = deps.report ?? (() => {})
  const device = deps.device
  const sleep = device?.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))

  let binding: Binding = { kind: 'none' }
  let desired: Target | null = null
  /** Bumped by every change of target and by both ends of a sign-out. */
  let generation = 0
  let flow: Flow | null = null
  let flowCounter = 0
  let signingOut = false
  let queued = 0
  let tail: Promise<void> = Promise.resolve()
  /** DISABLED: no new identity until the next launch (D9). */
  let serviceOff = false
  let recreates = 0

  let expirySubscription: { remove(): void } | null = null
  let consecutiveRefreshes = 0
  let refreshGiveUpReported = false
  /**
   * Every resubscription started so far, settled or not.
   *
   * A set rather than a single slot: rapid A -> B leaves A's confirmation still
   * polling when B's starts, and a single slot would drop A's promise on the
   * floor — both losing the rejection handler and letting a test that awaits
   * "the" resubscription pass on microtask ordering instead of on the guard.
   */
  const resubscriptions = new Set<Promise<void>>()

  /**
   * The one way to touch the native identity. A failure is reported and ends that
   * transition: the binding still says what the SDK holds, so the next trigger
   * tries again.
   */
  function enqueue(work: () => Promise<void>): Promise<void> {
    queued += 1
    const run = tail.then(work).catch(() => report('push_identity_transition_failed'))
    tail = run.finally(() => {
      queued -= 1
    })
    return tail
  }

  function holdFor(externalId: string): Promise<void> {
    return deps.settleNative ? deps.settleNative(externalId).catch(() => {}) : Promise.resolve()
  }

  /** Keeps a handle on an in-flight flow and swallows its rejection. */
  function track(current: Flow, pending: Promise<void>): void {
    const handled = pending.catch(() => {
      // Off the session path; a throw here must not surface as an unhandled
      // rejection in the app. The next trigger runs it again.
      current.state = 'retry'
      report('push_resubscribe_failed')
    })
    resubscriptions.add(handled)
    void handled.finally(() => resubscriptions.delete(handled))
  }

  function startFlow(gen: number): Flow {
    flow = { id: ++flowCounter, generation: gen, state: 'running' }
    return flow
  }

  async function bindUser(gen: number, userId: string): Promise<void> {
    const outcome = await deps.fetchToken()
    // The gap the old code left: the account may have changed during that fetch.
    if (gen !== generation) {
      report('push_identity_superseded')
      return
    }
    if (outcome.kind === 'ok') {
      // The endpoint decides the external id from the session, not the client.
      // Trusting the response over the argument keeps one source of truth.
      await deps.native.loginWithToken(outcome.token.externalId, outcome.token.token)
      binding = { kind: 'user', userId, externalId: outcome.token.externalId }
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
      report('push_identity_bound')

      // The ordered flow, and the order is the point:
      //   session -> JWT login -> *confirmed* identity -> eligible opt-in.
      //
      // `push_identity_bound` above means the call was made. It does not mean
      // the provider accepted it — under Identity Verification a refused JWT
      // leaves the SDK on a `local-` id, looking otherwise identical. Opting in
      // on the strength of the call returning is how a decision made for one
      // account lands on another.
      //
      // Off the queue: the supersede checks inside are what keep it safe. The
      // queue waits only for `settleNative`, the SDK finishing this login.
      const started = startFlow(gen)
      track(started, resubscribeIfEligible(started, userId))
      await holdFor(outcome.token.externalId)
      return
    }
    if (outcome.kind === 'unavailable' && deps.allowUnverified) {
      await deps.native.loginWithoutToken(userId)
      binding = { kind: 'user', userId, externalId: userId }
      startFlow(gen).state = 'done'
      report('push_identity_unverified')
      return
    }
    // Unbound is the honest state: no subscription is attributed to this user,
    // so nothing is delivered to them rather than delivered unverified.
    report(outcome.kind === 'unavailable' ? 'push_identity_unavailable' : 'push_identity_failed')
  }

  /**
   * Restores the subscription, but only for a login that is still current and
   * only where permission and preference allow it.
   *
   * Never prompts. `eligible` reports what the OS and the person have already
   * decided; asking here would spend the one permission prompt at sign-in,
   * which is exactly the moment it has not been earned.
   */
  async function resubscribeIfEligible(current: Flow, userId: string): Promise<void> {
    const superseded = () => {
      report('push_resubscribe_superseded')
    }
    const stillCurrent = () => current === flow && current.generation === generation
    const finish = (state: 'done' | 'retry') => {
      if (stillCurrent()) current.state = state
    }
    if (!deps.confirmIdentity || !deps.optIn) {
      finish('done')
      return
    }

    const confirmation = await deps.confirmIdentity(userId, stillCurrent)
    if (confirmation.kind !== 'confirmed') {
      finish('retry')
      return
    }

    // Re-checked after the await: confirmation can take seconds, and the
    // account may have changed inside that window.
    if (!stillCurrent()) return superseded()

    let allowed = false
    try {
      allowed = (await deps.eligible?.()) ?? false
    } catch {
      allowed = false
    }
    if (!stillCurrent()) return superseded()
    if (!allowed) {
      report('push_resubscribe_not_eligible')
      finish('retry')
      return
    }

    deps.optIn()
    report('push_resubscribed')

    // Only here, and only for a login that is still current. Everything above
    // had to be true first: identity confirmed by the provider, the OS
    // permitting notifications, and this device opted in. Reporting any earlier
    // would put a user in a campaign audience the provider cannot deliver to,
    // which is the failure this exists to end.
    if (!deps.reportSubscription) {
      finish('done')
      return
    }
    // The report is an authenticated call, and the account can change while it
    // is in flight; skipping a superseded one keeps the request off the wire
    // rather than relying on the server to sort it out.
    if (!stillCurrent()) return superseded()
    try {
      await deps.reportSubscription(userId)
      report('push_subscription_reported')
      finish('done')
    } catch {
      // Best-effort: the device is bound and subscribed either way, and the
      // next foreground or session change reports again.
      report('push_subscription_report_failed')
      finish('retry')
    }
  }

  /**
   * Retires what is waiting to be retired. The first failure ends the pass: the
   * next one would fail the same way and each costs up to two seconds of a queue
   * that a sign-in may be waiting behind.
   */
  async function drainRetirements(): Promise<void> {
    if (!device) return
    for (const credential of await device.credentials.retiring()) {
      const outcome = await device.retire(credential)
      if (outcome.kind !== 'done') {
        report(outcome.kind === 'malformed' ? 'push_device_credential_malformed' : 'push_device_retire_pending')
        return
      }
      await device.credentials.retired(credential.deviceId)
      report('push_device_retired')
    }
  }

  /** Whatever device identity this install still holds goes to the retiring list. */
  async function quarantineCurrent(): Promise<boolean> {
    if (!device) return false
    const credential = binding.kind === 'device' ? binding.credential : await device.credentials.read()
    if (!credential) return false
    await device.credentials.quarantine(credential)
    return true
  }

  async function toUser(gen: number, userId: string): Promise<void> {
    if (binding.kind === 'user' && binding.userId === userId) {
      if (flow?.generation !== gen || flow.state === 'retry') {
        const started = startFlow(gen)
        track(started, resubscribeIfEligible(started, userId))
      }
      return
    }
    // A different person gets a fresh budget: the previous user's refusals
    // say nothing about this one.
    consecutiveRefreshes = 0
    refreshGiveUpReported = false

    // Best effort and bounded (D2): a failure stays on the retiring list, and the
    // user's `register()` takeover retires the identity on the server anyway.
    try {
      if (await quarantineCurrent()) await drainRetirements()
    } catch {
      report('push_device_retire_pending')
    }
    if (gen !== generation) return

    if (binding.kind !== 'none') {
      // Account switch: the previous user's subscription must be released
      // before the next one claims it, or one device answers to two people.
      await deps.native.logout()
      report(binding.kind === 'user' ? 'push_identity_switched' : 'push_device_released')
      binding = { kind: 'none' }
    }
    if (gen !== generation) return
    await bindUser(gen, userId)
  }

  async function toNoSession(gen: number): Promise<void> {
    if (binding.kind === 'user') {
      // Logout, then forget — in that order, so a failure leaves the
      // service believing the device is still bound and tries again.
      await deps.native.logout()
      binding = { kind: 'none' }
      report('push_identity_logged_out')
    }
    if (!device || gen !== generation) return

    const snapshot = await device.promotions.load()
    // Could not tell what the person said. Nothing is restored, nothing retired.
    if (snapshot.read === 'unreadable') {
      report('push_device_history_unreadable')
      return
    }
    if (gen !== generation) return

    // R-17b: before any bound-device no-op.
    if (snapshot.answer !== 'accepted') {
      await neutralise(gen)
      return
    }
    await drainRetirements()
    if (gen !== generation) return

    if (binding.kind === 'device') {
      if (flow?.generation !== gen || flow.state === 'retry') {
        const started = startFlow(gen)
        track(started, runDeviceFlow(started, binding.externalId, binding.credential))
      }
      return
    }
    if (serviceOff) return
    await bindDevice(gen)
  }

  /**
   * R-17, R-17b: no disclosure on record, or a decline, and something survived a
   * reinstall or lost history. The credential is quarantined before anything else,
   * the SDK is opted out and logged out, and the server is asked to retire it until
   * it answers 2xx or GONE. Nothing here can restore an identity.
   */
  async function neutralise(gen: number): Promise<void> {
    if (!device) return
    const quarantined = await quarantineCurrent()
    const nativeHolder = binding.kind !== 'none' || quarantined || Boolean(await device.getNativeExternalId().catch(() => null))
    if (gen !== generation) return
    if (nativeHolder) {
      device.optOut()
      await deps.native.logout()
      binding = { kind: 'none' }
      report('push_device_neutralised')
    }
    await drainRetirements()
  }

  /** D3 steps 1-2. Disclosure (step 0) is already settled by the caller. */
  async function bindDevice(gen: number): Promise<void> {
    if (!device) return
    let credential = await device.credentials.read()
    let token: IdentityToken | null = null

    if (credential) {
      const renewed = await device.renew(credential)
      if (renewed.kind === 'ok') {
        token = renewed.token
      } else if (renewed.kind === 'gone') {
        await device.credentials.clear()
        credential = null
        report('push_device_gone')
      } else if (renewed.kind === 'disabled') {
        await serviceDisabled()
        return
      } else {
        report(
          renewed.kind === 'malformed'
            ? 'push_device_credential_malformed'
            : renewed.kind === 'unavailable'
              ? 'push_identity_unavailable'
              : 'signed_out_device_bind_pending',
        )
        return
      }
    }

    if (!credential) {
      if (gen !== generation) return
      const created = await device.create()
      if (created.kind === 'disabled') {
        await serviceDisabled()
        return
      }
      if (created.kind !== 'ok') {
        report(created.kind === 'unavailable' ? 'push_identity_unavailable' : 'signed_out_device_bind_pending')
        return
      }
      // Before the supersede check: a stored credential is what the sign-in that
      // overtook this one finds and retires. A dropped one would be orphaned.
      await device.credentials.write(created.credential)
      credential = created.credential
      token = created.token
    }

    if (gen !== generation || !token) {
      report('push_identity_superseded')
      return
    }

    await deps.native.loginWithToken(token.externalId, token.token)
    binding = { kind: 'device', externalId: token.externalId, credential }
    consecutiveRefreshes = 0
    refreshGiveUpReported = false
    report('push_device_bound')

    const started = startFlow(gen)
    track(started, runDeviceFlow(started, token.externalId, credential))
    await holdFor(token.externalId)
  }

  /** D9: the flag is off. Leave the provider, drop the credential, stop for this launch. */
  async function serviceDisabled(): Promise<void> {
    if (!device) return
    serviceOff = true
    device.promotions.setServiceOff(true)
    await device.credentials.clear()
    const holder = binding.kind === 'device' || (await device.getNativeExternalId().catch(() => null))?.startsWith(DEVICE_PREFIX)
    if (holder) await deps.native.logout()
    binding = { kind: 'none' }
    report('push_device_service_off')
  }

  /** The server says this identity no longer exists. A bound device is never a no-op then. */
  function deviceGone(gen: number): void {
    void enqueue(async () => {
      if (gen !== generation || !device) return
      await device.credentials.clear()
      binding = { kind: 'none' }
      report('push_device_gone')
      if (recreates >= MAX_DEVICE_RECREATES) return
      recreates += 1
      await bindDevice(gen)
    })
  }

  /** D3 steps 2-4, off the queue, re-checked before each side effect. */
  async function runDeviceFlow(current: Flow, externalId: string, credential: DeviceCredential): Promise<void> {
    if (!device) return
    const stillCurrent = () => current === flow && current.generation === generation
    const finish = (state: 'done' | 'retry') => {
      if (stillCurrent()) current.state = state
    }

    if (deps.confirmIdentity) {
      const confirmation = await deps.confirmIdentity(externalId, stillCurrent)
      if (!stillCurrent()) return
      if (confirmation.kind !== 'confirmed') {
        finish('retry')
        return
      }
    }

    if (device.promotions.snapshot().enabled) {
      let allowed = false
      try {
        allowed = (await deps.eligible?.()) ?? false
      } catch {
        allowed = false
      }
      if (!stillCurrent()) return
      if (!allowed) {
        // Nothing to report: the server refuses an opt-in the provider has disabled.
        report('push_device_not_eligible')
        finish('retry')
        return
      }
      deps.optIn?.()
    } else {
      // Before the report: a login restores delivery, and M-3 (d) measured that an
      // opt-out right after it overrides that.
      device.optOut()
    }

    const backoff = [...DEVICE_REPORT_BACKOFF_MS]
    let conflicts = 0
    for (;;) {
      const wait = async (): Promise<boolean> => {
        const ms = backoff.shift()
        if (ms === undefined) return false
        await sleep(ms)
        return stillCurrent()
      }

      const subscriptionId = await device.getSubscriptionId()
      if (!stillCurrent()) return
      if (!subscriptionId || !device.platform) {
        report(subscriptionId ? 'push_subscription_platform_unsupported' : 'push_subscription_id_missing')
        if (await wait()) continue
        finish('retry')
        return
      }

      const before = device.promotions.snapshot()
      const outcome = await device.submit(credential, {
        platform: device.platform,
        subscriptionId,
        promotionsEnabled: before.enabled,
        preferenceVersion: before.version,
      })
      // A response that came back after a newer choice was made clears nothing.
      if (!stillCurrent()) return

      switch (outcome.kind) {
        case 'ok': {
          device.promotions.acknowledge(outcome.result)
          recreates = 0
          const after = device.promotions.snapshot()
          if (after.pendingVersion === null && !after.awaitingProviderOff) {
            report('push_device_reported')
            finish('done')
            return
          }
          // Saved, but the provider still shows it enabled (R-16).
          report('push_device_awaiting_provider_off')
          if (await wait()) continue
          finish('retry')
          return
        }
        case 'stale':
          if (outcome.storedVersion === null) {
            report('push_device_report_failed')
            finish('retry')
            return
          }
          device.promotions.adoptStoredVersion(outcome.storedVersion)
          report('push_device_preference_stale')
          conflicts += 1
          if (conflicts <= MAX_DEVICE_REPORT_CONFLICTS) continue
          finish('retry')
          return
        case 'conflict':
          conflicts += 1
          if (conflicts <= MAX_DEVICE_REPORT_CONFLICTS) continue
          report('push_device_report_failed')
          finish('retry')
          return
        case 'not_confirmed':
          if (await wait()) continue
          report('push_device_not_confirmed')
          finish('retry')
          return
        case 'gone':
          deviceGone(current.generation)
          return
        case 'disabled':
          void enqueue(serviceDisabled)
          return
        case 'malformed':
          // A client bug, never GONE: discarding would hide it behind a new identity.
          report('push_device_credential_malformed')
          finish('done')
          return
        case 'error':
          report('push_device_report_failed')
          finish('retry')
          return
      }
    }
  }

  function targetOf(session: IdentitySession): Target {
    return session?.kind === 'user' && session.userId ? { kind: 'user', userId: session.userId } : { kind: 'device' }
  }

  function sameTarget(a: Target | null, b: Target): boolean {
    if (!a || a.kind !== b.kind) return false
    return a.kind === 'device' || a.userId === (b as { userId: string }).userId
  }

  /** The transition for what is wanted now. A newer target skips this one. */
  function transition(gen: number): Promise<void> {
    return enqueue(async () => {
      if (gen !== generation || !desired) return
      if (desired.kind === 'user') await toUser(gen, desired.userId)
      else await toNoSession(gen)
    })
  }

  /** Foreground and session emissions: re-run what did not finish (D3 recovery). */
  function retryPending(): Promise<void> {
    if (signingOut || !desired) return tail
    return transition(generation)
  }

  /** May this expiry callback still be answered? Asked before and after the fetch. */
  function answerable(externalId: string): boolean {
    if (signingOut) return false
    if (externalId.startsWith(DEVICE_PREFIX)) return binding.kind === 'device' && binding.externalId === externalId
    if (desired?.kind === 'device') return false
    return binding.kind !== 'user' || binding.externalId === externalId
  }

  async function freshToken(externalId: string): Promise<IdentityFetchOutcome | 'dropped'> {
    if (!externalId.startsWith(DEVICE_PREFIX)) return deps.fetchToken()
    if (!device || binding.kind !== 'device') return 'dropped'
    const gen = generation
    const renewed = await device.renew(binding.credential)
    if (renewed.kind === 'ok') return { kind: 'ok', token: renewed.token }
    if (renewed.kind === 'gone') {
      deviceGone(gen)
      return 'dropped'
    }
    if (renewed.kind === 'disabled') {
      void enqueue(serviceDisabled)
      return 'dropped'
    }
    if (renewed.kind === 'malformed') report('push_device_credential_malformed')
    return renewed.kind === 'unavailable' ? { kind: 'unavailable' } : { kind: 'error' }
  }

  return {
    /** Idempotent. Safe to call on every session emission. */
    apply(session: IdentitySession): Promise<void> {
      const target = targetOf(session)
      if (signingOut) {
        // The sign-out's own account, re-emitted while #160 runs: the session is
        // being ended on purpose, so nothing may re-bind it (D3).
        if (sameTarget(desired, target)) return tail
        signingOut = false
      }
      if (sameTarget(desired, target)) {
        return queued > 0 ? tail : retryPending()
      }
      desired = target
      generation += 1
      return transition(generation)
    },

    /**
     * Starts a sign-out, before anything is cleared. Every pending continuation and
     * expiry answer for this account is obsolete from here. #160 runs inside the
     * queue, so it can never interleave with a login. Rejects when not confirmed;
     * the caller then says `cancelSignOut`.
     *
     * A guest holds the device's identity, which outlives the guest session, so
     * there is nothing to tear down and no confirmation to ask for (#279).
     */
    beginSignOut(actor: 'user' | 'guest'): Promise<void> {
      if (actor === 'guest') return Promise.resolve()
      signingOut = true
      generation += 1
      return new Promise<void>((resolve, reject) => {
        void enqueue(async () => {
          try {
            await deps.confirmSignOut?.()
            binding = { kind: 'none' }
            resolve()
          } catch (error) {
            // `unsubscribe` may have gone out before the check failed, so the SDK
            // is not trusted to still hold the user; `cancelSignOut` binds again.
            binding = { kind: 'none' }
            reject(error instanceof Error ? error : new Error('push_sign_out_failed'))
          }
        })
      })
    },

    /** The session stays. Binds again, past the ordinary same-user no-op (R-21). */
    cancelSignOut(): Promise<void> {
      // A guest began nothing, and holds the device's identity throughout.
      if (!signingOut) return tail
      signingOut = false
      generation += 1
      report('push_sign_out_cancelled')
      return transition(generation)
    },

    /** Sheet or Settings. Recorded now; what it implies runs as a transition. */
    answerDisclosure(answer: DisclosureAnswer): Promise<void> {
      if (!device) return tail
      device.promotions.answer(answer)
      return restartFlow()
    },

    /** The switch. The SDK and the server follow; an offline change replays (D5). */
    setPromotions(enabled: boolean): Promise<void> {
      if (!device) return tail
      if (enabled && device.promotions.snapshot().answer !== 'accepted') device.promotions.answer('accepted')
      else device.promotions.setEnabled(enabled)
      return restartFlow()
    },

    retryPending,

    /**
     * The SDK asks for a fresh token when the one it holds expires or is
     * refused. Answering is the retry; not answering leaves the request open,
     * which is why a failed fetch reports and returns rather than throwing into
     * the native callback.
     */
    start(): void {
      expirySubscription ??= deps.native.onJwtExpired((externalId) => {
        void (async () => {
          // R-21: a callback for an identity this device is leaving, or has left.
          if (!answerable(externalId)) {
            report('push_identity_refresh_superseded')
            return
          }
          if (consecutiveRefreshes >= MAX_CONSECUTIVE_JWT_REFRESHES) {
            // Reported where the loop actually stops, and latched.
            //
            // The obvious place — after the last replacement is sent — is
            // wrong, and a test caught it: `respondToJwtExpired` re-enters this
            // handler synchronously, so several invocations are in flight at
            // once and every one of them unwinds past the same check. That
            // logged the give-up three times, which is the noise the cap
            // exists to remove.
            if (!refreshGiveUpReported) {
              refreshGiveUpReported = true
              report('push_identity_refresh_rejected_repeatedly')
            }
            return
          }
          consecutiveRefreshes += 1

          const gen = generation
          const outcome = await freshToken(externalId)
          if (outcome === 'dropped') return
          if (outcome.kind !== 'ok') {
            report('push_identity_refresh_failed')
            return
          }
          // No await between this check and the native call.
          if (gen !== generation || !answerable(externalId)) {
            report('push_identity_refresh_superseded')
            return
          }
          await deps.native.respondToJwtExpired(externalId, outcome.token.token)
          report('push_identity_refreshed')
        })()
      })
    },

    /**
     * Allow the refresh budget to be spent again.
     *
     * The cap stops a loop against a provider that is refusing every token, and
     * the usual cause is a configuration only a person can correct — a key
     * replaced in the dashboard, enforcement toggled. When that is fixed the
     * app is typically still running, already given up, and would stay unbound
     * until the next login or a restart.
     *
     * The caller decides when a retry is warranted; `identity-bootstrap` uses
     * the app returning to the foreground, which is both a natural retry moment
     * and rare enough that it cannot reconstitute the loop.
     */
    resetRefreshBudget(): void {
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
    },

    /**
     * Resolves when every transition has finished and every in-flight
     * resubscription has settled, including ones started by a login that has since
     * been superseded.
     *
     * For tests. Nothing in the app waits on this — resubscription is
     * deliberately off the session-change path.
     */
    async settled(): Promise<void> {
      // Loop: settling one can start nothing new here, but a pending A can
      // resolve *after* B was added, and awaiting one snapshot would miss it.
      while (queued > 0 || resubscriptions.size > 0) {
        await tail
        await Promise.all([...resubscriptions])
      }
    },

    stop(): void {
      expirySubscription?.remove()
      expirySubscription = null
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
    },

    /** Test seam only. */
    boundUserId: () => (binding.kind === 'user' ? binding.userId : null),
    /** Test seam only. */
    boundDeviceId: () => (binding.kind === 'device' ? binding.credential.deviceId : null),
  }

  /** A newer choice: the running flow stops, a new one carries the newest version. */
  function restartFlow(): Promise<void> {
    if (signingOut || desired?.kind !== 'device') return tail
    flow = null
    return transition(generation)
  }
}
