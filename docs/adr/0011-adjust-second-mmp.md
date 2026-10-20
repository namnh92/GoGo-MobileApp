# ADR 0011: Adjust as a second MMP beside Tenjin

Accepted for GoGo-MobileApp#367 (MMP-APP-001, epic #363). Shape:
`dev/handoffs/sa-shape-mobile-363-adjust.fable.md` (rev 1) and `…fable.rev2.md`
(rev 2) in the workspace. Owner decisions 2026-10-19 (workspace
`.claude/rules/execution-policy.md` §8): keep both Tenjin and Adjust; dev/stag
report to Adjust's sandbox, prod to production, fixed in code; privacy review
and DPA before the first device run with a real token.

## Context

Tenjin is integrated (ADR 0007) and stays as it is. The owner registered
Adjust (plan Base) and wants it running alongside. ATT is asked by GoGo itself
(ADR 0012), so both SDKs read the IDFA when iOS allows it. The deferred-link
store (#364) has a reader and accepts more than one writer.

## Decision

- **SDK:** `react-native-adjust` 5.8.0, pinned (Adjust iOS/Android SDK 5.8.0).
  Only `src/shared/acquisition/bootstrap.ts` loads it, **lazily and after a
  native preflight** (`adjust/native-preflight.ts`). The wrapper reads
  `NativeModules.Adjust` and builds a `NativeEventEmitter` — on iOS from
  `NativeModules.AdjustEventEmitter`, which the emitter refuses when null —
  while it is evaluated. A build whose native side is missing (stale pods, a
  failed New Architecture interop) therefore throws from the module factory,
  and a `try/catch` around `import()` is **not** enough: Metro's `require`
  runs a deferred factory through `guardedLoadModule`, which hands an
  evaluation error to `ErrorUtils.reportFatalError` before the importing
  promise rejects (metro-runtime 0.83 `polyfills/require.js`) — a crash in a
  release build (PR #369 Astra F-01, second attempt). So the bootstrap checks
  the exact native modules the wrapper touches, on the same `NativeModules`
  surface (null when absent, on the bridge and on the bridgeless proxy), and
  evaluates the wrapper only when they exist. Absent →
  `acquisition_adjust_unavailable:native_missing`, then
  `acquisition_adjust_unavailable`; the `catch` stays as the second line for a
  load that rejects (a stalled split-bundle fetch in development). A wrapper
  that passes the preflight and still throws at evaluation is a build defect
  Metro reports as it reports any other — deliberately not hidden. The Adjust
  APIs the app may call are an allowlist test (`adjust-boundary.test.ts`).
  Android needs no plugin of its own: the module declares `AD_ID`, and
  Tenjin's plugin already adds Play install referrer, ads identifier and App
  Set.
- **Roles (shape D1):** both SDKs start on every launch; Adjust is the MMP read
  for install attribution and the second writer of deferred links. Neither is
  business truth (spec §19): "installs (Adjust)" and "installs (Tenjin)" are two
  labelled series, never summed. **No events in phase 1** — no event token, no
  user id, no PII leaves for Adjust (test-pinned: no `trackEvent`).
- **Config (shape D4):** build-time `ADJUST_IOS_APP_TOKEN`,
  `ADJUST_ANDROID_APP_TOKEN` (8–32 letters/digits, or `off`) and
  `ADJUST_CONFIG_ENV`, rendered from SSM by GoGo-Infra `mobile-env.py`
  (GoGo-Infra#237). Tokens: dev may be empty; stag/prod need a token or `off`.
  `ADJUST_CONFIG_ENV` is **required in every build, whatever the tokens** —
  empty, `off` or real — and must equal the flavour's environment (`dev`,
  `staging`, `prod`), like Tenjin's marker: a generated env file from another
  environment is refused even when it carries no token (PR #369 Sol F-04/F-07;
  older local `.env` files need the line added). The SDK environment is derived
  from the flavour in code: prod → production, everything else → sandbox.
- **Start order:** after the install reset (#364) — so a deferred link can only
  land in this install's store — then `disableDeferredDeeplinkOpening`,
  `setAttConsentWaitingInterval(60)`, deferred-link and attribution callbacks,
  `initSdk`. Once per process; a failure is `acquisition_adjust_unavailable`,
  never a failed launch. The SDK never asks for ATT and never navigates.
- **Deferred links (shape D2):** Adjust writes through the same
  `PendingDeepLinkStore.remember()` (parse gate, first writer wins, consumed
  history), and only a link that is this build's own — its scheme or GoGo's web
  host for the flavour; `parseDeepLink` alone ignores the host. The store runs
  its operations one at a time, so two writers cannot both see an empty slot.
  Reason codes carry `:adjust`. One launch window — 70 s on iOS (60 s ATT wait +
  10 s), 10 s on Android; a report after it is `…ignored:late:adjust`.
- **Added in build, not in the shape:** the resume's `settled` now also waits
  for Adjust. The shape bounded writes by "the window, or the first `take()`",
  but the resume takes once, right after Tenjin and the ATT question settle — an
  Adjust link arriving later in the window would be dropped. So the Adjust sink
  settles only on a definitive event: Adjust delivered a deferred link, another
  writer already won (a link is pending — then the window has nothing left to
  decide), Adjust is not running, or the window ended. An attribution callback
  is **not** one: Adjust documents no "no deferred link" signal. Cost: on a
  launch where neither MMP reports a link, the first resume waits up to the
  window (10 s Android, 70 s iOS) — and nothing is waiting to open then.
  Two consequences of "settles on its own events only" (PR #369 Astra F-03,
  F-06): **(a)** the store tells its listeners after every write it kept
  (`PendingDeepLinkStore.onStored`), and the Adjust sink subscribes for its
  window — so Tenjin's callback landing *after* its collector's 10 s timeout
  (the collector resolves, the callback still writes) closes the window at
  once instead of at 70 s; the `hasPending()` check at sink creation stays
  for a link kept before the sink existed. **(b)** the SDK is loaded and
  started off the settle chain: `runAdjust` returns `sink.settled()` as soon
  as the sink exists, and `startAdjustSdk` (preflight → `import()` → init)
  runs detached, closing the sink only when it fails. A stalled import can
  no longer hold the resume past the window or past another writer's win;
  the SDK still starts when the import lands later, because Adjust is this
  launch's attribution report whatever the deferred link decided.
  **Unverified on device** (cell DL-1 not run).

## Consequences

- `docs/store-privacy.md`: sixth destination, D24, T5, §6/§7 rows, §12 D-4/D-5.
- Startup gains one native init; measured in device cells.
- Account deletion (ADR-0023) does not reach Adjust; `gdprForgetMe()` is per
  device and not wired — known limitation.
- New Architecture: the RN wrapper uses `NativeModules`, so it runs through the
  interop layer. **Unverified** — device cell N-1 (module loads with
  `newArchEnabled: true`) has not run.
- Device cells (S-1…S-4, T-1, N-1, DL-1 with ATT columns) are NOT RUN; they wait
  for the privacy review and the owner's DPA acceptance (owner Q5) and the legal
  question in `docs/store-privacy.md` §10 Q6.

## Rollback

Remove the `runAdjust` call and the dependency, rebuild; Tenjin, the store and
the resume are untouched. The declaration in `docs/store-privacy.md` keeps
Adjust until a build without it is the one being submitted.
