# Issue 596 — G5 invite fixes (2026-11-13)

Basis: `feature/GOGO-596-redesign-g05c-invite`, HEAD `d938cc07d2c4bca0cca30fd077af88ac9d5ab4c5` (coordinator merge of `a7aa16e7`). Owner scope: G5-01/G5-02 only, PR #638 → `re-design`. Changes remain unstaged; no install, commit, push or simulator build.

| ID | Change | Files | Verification |
| --- | --- | --- | --- |
| G5-01 | Preview 404/410 renders the existing `InviteExpired` for every session. 404 → unusable + request-link guidance; 410 `INVITE_NOT_USABLE`/unknown code → expired; `ROOM_NOT_JOINABLE`/`ROOM_EXPIRED` → unusable without request-link guidance. No join/retry control on terminal state. Transient/network errors retain banner + retry. | `src/features/gogo-room/guest-join.view.tsx`; `src/features/__tests__/invite-preview.spec.tsx` | Signed-in 404 and all three named 410 codes plus unknown 410. Existing audience × user/anonymous/guest matrix now expects terminal recovery consistently. Transient retry still loads facts. |
| G5-02 | Keep header; show room-type badge only when preview supplies room type. Add 16pt bottom margin to the preview error banner, separate from in-card submit errors. | `src/features/gogo-room/guest-join.view.tsx`; `src/features/gogo-room/guest-join.style.tsx`; `src/features/__tests__/invite-preview.spec.tsx` | “Lời mời tham gia” renders once during loading/network error/couple/group; room-aware badges remain. Rendered banner style has `spacing[4]` bottom margin. |

## Stitch and contract basis

Read live Stitch project `17315762413421369447`: S40 `14972595260953532404` HTML uses badge “Lời mời date” and outer `space-y-space-lg`, where `space-lg = 1rem` (16pt). Retain the existing header and use the existing `guestJoin.badge_couple` / `guestJoin.badge_group` i18n keys once room facts are available; no guessed room type while loading or on preview error. S25 `10219812896993323843` is “Liên kết không còn dùng được”; S59 `9068423104561654909` is “Lời mời đã hết hạn”. Reuse their existing state component unchanged.

`openapi/gogo.v1.yaml` `/rooms/invites/preview` documents 404 and the three 410 codes. No contract, session, join transport, route or telemetry changes. Core rules 3, 10, 16 and 17 retained. The older F-01 test allowing signed-in re-entry after terminal preview was superseded by the explicit owner instruction dated 2026-11-13; successful re-entry after a usable preview remains supported.

## Regression evidence

- Verified `git diff --quiet 31f65eb2 HEAD -- src/features/gogo-room/guest-join.view.tsx src/features/gogo-room/guest-join.style.tsx` exits 0: both production files were identical to the finding head before edits.
- FAIL before: `pnpm test:ui --runInBand src/features/__tests__/invite-preview.spec.tsx`, exit 1, **20 failed / 123 passed / 143 total** against unchanged production files. Failures: 12 signed-in terminal cases across three audience fixtures; five explicit G5-01 cases (404, three named 410 codes, unknown 410); duplicate label in loading/network states (two cases); absent banner spacing style (one case).
- The initial spacing assertion inspected the absent style definition; after adding the style, it was strengthened to inspect the actual rendered banner. All G5-01 and duplicate-label cases are unchanged between FAIL and PASS.
- Exact-head confirmation using the final assertions: copied view/style via `git show 31f65eb2:<path>` to `/tmp/mobile-596-g5-baseline/`, redirected only relative imports to their unchanged worktree dependencies, and mapped the screen import to that isolated copy with a temporary Jest config. Worktree production files stayed fixed throughout. `pnpm exec jest --config /tmp/mobile-596-g5-baseline/jest.config.js --runInBand src/features/__tests__/invite-preview.spec.tsx -t 'G5 sim fixes'` exits 1: **eight failed / two passed / 133 skipped**. All five terminal cases and both duplicate-label cases fail; banner assertion cannot find the new banner hook on the old view. Log: `/tmp/mobile-596-baseline-exact.log`.
- PASS after: same targeted command, exit 0, **143/143 tests**. Local logs: `/tmp/mobile-596-before.log`, `/tmp/mobile-596-after.log`. Final focused confirmation: `pnpm test:ui --runInBand src/features/__tests__/invite-preview.spec.tsx -t 'G5 sim fixes'`, exit 0, **10/10 G5 tests** (`/tmp/mobile-596-g5-final.log`).

## Gates

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/mobile-596-typecheck.log` |
| `pnpm lint` | PASS, exit 0; four pre-existing `no-require-imports` warnings in `assistant-keyboard-offset.spec.tsx` and `assistant-usage-footer.spec.tsx` | `/tmp/mobile-596-lint.log`; no warnings in changed files |
| `pnpm test:ui --runInBand` (full) | PASS, exit 0: 262 suites, 4,183 tests, 11 snapshots | `/tmp/mobile-596-ui.log` |
| `pnpm test` | FAIL, exit 1: 153 files passed, one failed, one skipped; 1,830 tests passed, three failed, 39 skipped | `/tmp/mobile-596-test.log` |
| `git diff --check` | PASS | No whitespace errors |

The three unit failures are in unchanged `src/shared/config/__tests__/distribute-wrapper.test.ts`: “refuses while the owner is alive” (line 208, `spawnSync('ps').stdout` undefined), “refuses recovery while a recorded build process group is still alive” (line 234, unexpected exit 0), and “keeps the lock and run files when a recorded build group is still alive after the child exits” (line 258, unexpected exit 0). The sandbox directly rejects `ps` with `operation not permitted`; distribution lock detection depends on process inspection. `git diff --quiet HEAD -- scripts/distribute.sh src/shared/config/__tests__/distribute-wrapper.test.ts` exits 0. The first failure is directly attributable to denied process inspection; the other two are consistent with the same limitation. This gate is not green; no distribution fixes or sandbox bypass were attempted.

Patch fingerprints (SHA-256; docs excluded):

```text
966405ae55a1a15ef8f237c6660a5dbb7cf01f0e88e93d30260256a2e25cac66  src/features/gogo-room/guest-join.view.tsx
158363d84e81fc07383dd087ee9c0bc896e4bd4ad2c31dc501aa527c600aba90  src/features/gogo-room/guest-join.style.tsx
f00856bd1de6aa68c93778d3fa3602c32e2243f167eb528b157ccd2dbe1659ff  src/features/__tests__/invite-preview.spec.tsx
```

## Acceptance boundary

Component tests prove render/state/retry behavior; no new simulator visual acceptance, DEV acceptance, or PR/CI review is claimed. Existing shared typography, role colors and view/style split remain in use.
