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
  Only `src/shared/acquisition/bootstrap.ts` imports it (test-pinned). Android
  needs no plugin of its own: the module declares `AD_ID`, and Tenjin's plugin
  already adds Play install referrer, ads identifier and App Set.
- **Roles (shape D1):** both SDKs start on every launch; Adjust is the MMP read
  for install attribution and the second writer of deferred links. Neither is
  business truth (spec §19): "installs (Adjust)" and "installs (Tenjin)" are two
  labelled series, never summed. **No events in phase 1** — no event token, no
  user id, no PII leaves for Adjust (test-pinned: no `trackEvent`).
- **Config (shape D4):** build-time `ADJUST_IOS_APP_TOKEN`,
  `ADJUST_ANDROID_APP_TOKEN` (8–32 letters/digits, or `off`) and
  `ADJUST_CONFIG_ENV`, rendered from SSM by GoGo-Infra `mobile-env.py`
  (GoGo-Infra#237). dev may be empty; stag/prod need a token or `off`; a real
  token must match its environment. The SDK environment is derived from the
  flavour in code: prod → production, everything else → sandbox.
- **Start order:** after the install reset (#364) — so a deferred link can only
  land in this install's store — then `disableDeferredDeeplinkOpening`,
  `setAttConsentWaitingInterval(60)`, deferred-link and attribution callbacks,
  `initSdk`. Once per process; a failure is `acquisition_adjust_unavailable`,
  never a failed launch. The SDK never asks for ATT and never navigates.
- **Deferred links (shape D2):** Adjust writes through the same
  `PendingDeepLinkStore.remember()` (parse gate, first writer wins, consumed
  history). One launch window — 70 s on iOS (60 s ATT wait + 10 s), 10 s on
  Android; a report after it is `…ignored:late:adjust`.
- **Added in build, not in the shape:** the resume's `settled` now also waits
  for Adjust. The shape bounded writes by "the window, or the first `take()`",
  but the resume takes once, right after Tenjin and the ATT question settle — an
  Adjust link arriving later in the window would be dropped. So the Adjust sink
  settles when Adjust has answered (a deferred link; or an attribution plus a
  2 s grace for a link from the same response — callback order is not
  documented) or when the window ends. Cost: on a launch where Adjust is silent
  the first resume waits up to the window. Measured on device (DL-1).

## Consequences

- `docs/store-privacy.md`: sixth destination, D24, T5, §6/§7 rows, §12 D-4/D-5.
- Startup gains one native init; measured in device cells.
- Account deletion (ADR-0023) does not reach Adjust; `gdprForgetMe()` is per
  device and not wired — known limitation.
- New Architecture: the RN wrapper uses `NativeModules`, so it runs through the
  interop layer; device cell N-1 confirms it loads.

## Rollback

Remove the `runAdjust` call and the dependency, rebuild; Tenjin, the store and
the resume are untouched. The declaration in `docs/store-privacy.md` keeps
Adjust until a build without it is the one being submitted.
