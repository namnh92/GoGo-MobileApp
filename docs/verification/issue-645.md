# Issue #645 — sheet closes without waiting for device identity

2026-11-11 · `feature/GOGO-645-promo-sheet-close` · base `c2e7c9c31acde2ba7a500cee9e64b5903be87541`.
Owner option A: iOS permission → answer **saved** → close + commit haptic. Only device identity convergence continues in the background, with rejection consumed. Coordinator queue/retry/report and decline are unchanged.

## Round 1 — superseded by F-01

The first patch closed on invocation of the answer, before persistence. Astra marked it changes-required (F-01, P2). The tests below mocked the entire answer promise, so they did not distinguish pending storage from pending identity convergence. These results are historical, not verification of the corrected save ordering.

### FAIL before / PASS after

Added the regression spec first and ran it against the unchanged base gate, then edited the gate and reran the same command. No stash, reset, or temporary replacement was used.

```sh
pnpm test:ui device-promotions-gate --runInBand --watchman=false -t 'closes after permission resolves even when the identity answer never settles'
```

- **FAIL before (exit 1):** `1 failed, 16 skipped, 17 total`. `expect(screen.queryByText(TITLE)).toBeNull()` received the visible `Nhận ưu đãi từ GoGo?` header after permission resolved and `answer('accepted')` was called with a never-settling promise. This reproduces the identity-transition hang.
- **PASS after (exit 0):** `1 passed, 16 skipped, 17 total`. The same never-settling answer no longer holds the sheet open.

### Checks on the round-1 code

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui device-promotions --runInBand --watchman=false` | PASS, exit 0; 2 suites, 26 tests |
| `CI=1 pnpm lint src/shared/notifications/device-promotions-gate.tsx src/shared/notifications/__tests__/device-promotions-gate.spec.tsx` | PASS, exit 0 |
| `git diff --check` | PASS |

Added tests:

- `closes after permission resolves even when the identity answer never settles`
- `keeps the sheet open and the button busy only while permission is pending`
- `does not flash back while the store still reports absent`
- `handles a background answer rejection without reopening or another commit haptic`

Component evidence only; simulator/DEV acceptance was not run. No dependency, view/style, i18n, or identity-session changes. No staging or commit.

## Round 2 — F-01: wait for persistence, not identity convergence

2026-11-11 · same base `c2e7c9c31acde2ba7a500cee9e64b5903be87541` + uncommitted diff.

The gate starts `actions.answer('accepted')` as before and consumes its background rejection. The production action starts the write synchronously in the same store injected into the gate. The gate then awaits that store's existing `saved(): Promise<boolean>` confirmation, independently of the coordinator's combined save/transition promise. No coordinator API, identity-session queue, retry, or reporting changes.

- Permission pending or save pending: sheet stays visible; the primary button stays disabled and busy; no commit haptic.
- Save succeeds: close and emit one commit haptic even if the identity transition never settles.
- Save returns false: stop loading and keep the sheet open for retry, despite the optimistic snapshot already reporting `read: 'loaded'`. A retry stays busy until its write succeeds.
- Local completion prevents a stale subscriber from flashing the sheet back. Background transition rejection does not reopen it or emit another haptic.
- Mounted guards run after permission and after storage confirmation. Unmount during permission skips the answer and completion effects; an already-started write can finish after unmount without a completion haptic or state update.

### FAIL before / PASS after

Added the pending-save regression before changing the round-1 gate. It uses `createDevicePromotionsStore` with a deferred `storage.setItem`, and the injected answer writes to that same store. Separate tests control the identity transition after a real successful write and fail the real storage write. Persistence is not mocked away.

```sh
pnpm test:ui device-promotions-gate --runInBand --watchman=false -t 'keeps the sheet open and button busy while the answer save is pending'
```

- **FAIL before (exit 1):** `1 failed, 19 skipped, 20 total` against the existing round-1 gate. The assertion confirming `{ read: 'loaded', answer: 'accepted', save: 'saving' }` passed; `getByText('Nhận ưu đãi từ GoGo?')` failed because the sheet had already closed while the answer's disk write was unresolved.
- **PASS after (exit 0):** `1 passed, 19 skipped, 20 total` with the same regression after the gate fix. The sheet/button stay visible/busy until the write resolves, then close with a commit haptic.
- Subsequently added unmount-during-save coverage and strengthened the retry assertions. The final UI run passes all 30 tests, including the unchanged pending-save regression.

Raw logs: `/tmp/mobile-645-round2-fail-before.log` and `/tmp/mobile-645-round2-pass-after.log`.

### Final checks

Code/test review snapshot: `rs-7001b4182771`, created before the final checks and verified `MATCH` after them. Scope: the gate and its spec; verification documentation is excluded from this tested-code identity. Manifest and retrievable diff: `/tmp/mobile-645-round2-snapshots/mobile-645-round2-tested-rs-7001b4182771/`.

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui device-promotions --runInBand --watchman=false` | PASS, exit 0; 2 suites, 30 tests |
| `pnpm test notifications` | PASS, exit 0; Vitest, 18 files, 243 tests |
| `CI=1 pnpm lint src/shared/notifications/device-promotions-gate.tsx src/shared/notifications/__tests__/device-promotions-gate.spec.tsx` | PASS, exit 0 |
| `git diff --check` | PASS |

Final command logs: `/tmp/mobile-645-round2-{typecheck,ui,notifications,lint}.log`.

Component/unit evidence only; simulator/DEV acceptance and independent Round 2 review have not run. No staging or commit.

## Round 3 — F-02 and F-03

2026-11-11 · base `6635b55c` (`feature/GOGO-645-promo-sheet-close`) + uncommitted diff. Owner approved this extra fix round after Astra's changes-required review at `6635b55`.

- **F-02 (P2):** after a failed acceptance save, decline now starts its answer write, consumes background identity rejection, and waits for `store.saved()`. While saving, the sheet stays busy. A successful decline clears `saveFailed`, marks local completion and closes; a failed save leaves the sheet open for retry. Identity convergence does not hold completion open.
- **F-03 (P2):** permission settlement always starts `actions.answer('accepted')`, including after unmount. The mounted guard applies only to component state updates and the completion haptic after storage confirmation. This supersedes Round 2's unmount-during-permission behavior. The test asserts a saved acceptance, no calls to the gate's four captured state setters or any haptic after unmount, and no sheet on remount.
- **Stale subscriber coverage:** the answer now uses the real store write and asserts the persisted JSON contains `accepted`. Only after successful persistence does the test expose the prior `absent` snapshot and verify it cannot reopen the sheet. No no-op answer or earlier preparation write stands in for saved acceptance.

Round 2's pending-save, failed-save/retry, never-settling identity transition and consumed background rejection coverage remains passing. No identity-session, coordinator, store, dependency, view/style or i18n changes.

### FAIL before / PASS after

```sh
pnpm test:ui device-promotions-gate --runInBand --watchman=false -t 'closes after a failed acceptance save|records acceptance without state updates'
```

The initial regression run used the unchanged `6635b55` gate before the fixes. After finalizing test annotations/assertions, the same final tests were run again with the gate temporarily replaced by the exact `git show 6635b55:src/shared/notifications/device-promotions-gate.tsx` contents; the fixed bytes were restored in a `finally` block. No Git reset, staging or commit was used. The tested-code snapshot verified `MATCH` after restoration.

| Finding | FAIL before on `6635b55` (exit 1) | PASS after (exit 0) |
| --- | --- | --- |
| F-02 | Store reached `{ answer: 'declined', save: 'saved' }`, but the title remained visible and `toBeNull()` failed. | The sheet stays open during the decline write, then closes after it succeeds. |
| F-03 | After unmount and permission resolution, `answer` had 0 calls instead of 1. | Acceptance is saved; no state setter/haptic runs after unmount; remount does not ask again. |

Focused totals: **2 failed, 20 skipped, 22 total before; 2 passed, 20 skipped, 22 total after**. Logs: `/tmp/mobile-645-round3-fail-before.log` and `/tmp/mobile-645-round3-pass-after.log`.

### Checks

Tested-code snapshot: `rs-f343e2631525`, scope = gate + gate spec; verification documentation excluded. Created before the final checks and verified `MATCH` before and after them. Manifest and retrievable patch: `/tmp/mobile-645-round3-snapshots/mobile-645-round3-tested-rs-f343e2631525/`.

| Command | Result |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui device-promotions --runInBand --watchman=false` | PASS, exit 0; 2 suites, 31 tests |
| `CI=1 pnpm lint src/shared/notifications/device-promotions-gate.tsx src/shared/notifications/__tests__/device-promotions-gate.spec.tsx` | PASS, exit 0; allowed by sandbox |
| `git diff --check` | PASS |

Final logs: `/tmp/mobile-645-round3-{typecheck,ui,lint}.log`. The first typecheck caught a test-only `useState` spy overload annotation; the annotation was corrected before the final passing runs.

Component evidence only; simulator/DEV acceptance and independent Round 3 review have not run. No staging or commit.
