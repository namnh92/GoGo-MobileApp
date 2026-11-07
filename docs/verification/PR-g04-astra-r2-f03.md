# Astra r2 F-03 — saved mutations across account changes

Date: 2026-11-07. Started clean at `f7a9189d2dc1821387770e06ac835786bf8ef68f` in `mobile-g04`. Fix remains uncommitted. No install, commit or push.

Tested source snapshot: `rs-06affe8ca455`, scope `src`, manifest and retrievable sources at `/tmp/mobile-g04-f03-snapshots/mobile-g04-f03-verified-rs-06affe8ca455/`. Documentation is outside this snapshot. Verification before and after the final gates reported MATCH.

## Change

- `src/shared/api/session.ts:62`: account generation changes on sign-out, hydration of a different actor and direct account switches. Token rotation within the same account keeps the generation. Signing out and back into A invalidates A's old work.
- `src/shared/api/queries/use-me.ts:166`: both mutation entry points capture the generation synchronously. Queue keys include it, so B can mutate without waiting for A. Guards run before queue reservation, after queue/cancellation waits, before each network attempt, and after its response. Obsolete work neither rolls back nor invalidates B's cache. Every reserved turn still releases.
- `src/shared/api/endpoints/me.ts:14` and `src/shared/api/client.ts:196`: saved requests carry the expected generation through credential hydration/renewal and HTTP 401 replay. No obsolete saved request is sent with a new account's credentials.
- `src/shared/api/client.ts:119`: a late refresh response cannot restore A or sign out B. Successful and rejected refresh responses are both checked before session changes.
- No public BFF contract, generated declaration, analytics payload or product copy changes.

## Regression proof

Production sources were untouched at `f7a9189` for the FAIL-before run; only the regression spec was added. Command:

`pnpm test:ui --runInBand src/shared/api/queries/use-saved-mutations.spec.tsx`

- FAIL-before: **3 failed / 6 passed**. Two cases recorded a PUT by **B** when A's pending removal succeeded or failed. The third recorded a second removal attempt after switching to B.
- PASS-after: focused UI run **4 suites / 33 tests passed**, including all 13 saved-mutation cases. Obsolete work is rejected, no PUT or retry reaches B, B's saved cache stays intact, and old settlement does not invalidate it.
- Additional coverage: same-account sign-out/sign-in, normal token rotation, direct A → B transition, B's independent same-target save, and switching while cancellation is awaited.
- Transport coverage: **6 tests** cover obsolete PUT/DELETE, an old 401, late refresh success/failure preserving B, and normal account-preserving renewal. Together with existing API regressions: **2 suites / 12 tests passed**.
- Self-review also reproduced A's late refresh overwriting B before adding the refresh completion guard. That check failed with A replacing B, then passed after the guard.

Logs:

- `/tmp/mobile-g04-f03-before.log`
- `/tmp/mobile-g04-f03-after-final.log`
- `/tmp/mobile-g04-f03-refresh-before.log`
- `/tmp/mobile-g04-f03-transport-final.log`

## Final gates

- `pnpm typecheck`: PASS (`/tmp/mobile-g04-f03-typecheck-final.log`).
- `pnpm lint`: PASS (`/tmp/mobile-g04-f03-lint-final.log`).
- `pnpm test`: FAIL, **119 suites passed / 1 failed / 1 skipped; 1,349 tests passed / 3 failed / 39 skipped** (`/tmp/mobile-g04-f03-test-final.log`). All six saved-session transport tests passed; the failures are the unchanged process checks described below.
- `pnpm test:ui --runInBand`: PASS, **188 suites / 2,239 tests** (`/tmp/mobile-g04-f03-ui-final.log`).
- `git diff --check`: PASS.

The known full-unit limitation is unchanged: `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, `:258` depend on process inspection blocked by this sandbox. Direct checks returned `/bin/ps: operation not permitted` and `pgrep: Cannot get process list` / `sysmond service not found` (`/tmp/mobile-g04-f03-process-check.log`). These tests were not changed or skipped.

This is local regression evidence; no deployed-backend or visual acceptance is claimed.
