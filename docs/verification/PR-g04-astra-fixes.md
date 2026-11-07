# Group 04 — Astra finding repairs

Date: 2026-11-07. Basis: clean `25b9ba0`, branch `feature/GOGO-482-redesign-g04-saved`, reviewed against `4c3961d`. Changes remain uncommitted. No install, commit or push.

Source snapshot: `rs-576706ac6371`, scope `src` + `openapi`; manifest and retrievable patch/untracked files under `/tmp/mobile-g04-snapshots/mobile-g04-astra-fixes-rs-576706ac6371/`. Documentation is outside this source snapshot's scope.

## F-01 — complete generated contribution types

- Restored `openapi/gogo.v1.yaml` verbatim from `4c3961d`, retaining the complete stacked contract instead of replacing it with a BE snapshot missing #516 additions.
- Regenerated `src/shared/api/schema.d.ts` with `pnpm api:types`. Contract and generated declarations both match `4c3961d` exactly. `types.ts` imports these directly; the incomplete `stacked-contribution-schema.d.ts` is deleted.
- Regression: `src/shared/api/__tests__/contribution-contract.test.ts:5` compiles the declaration graph with `skipLibCheck: false`; its fixture rejects invalid currency, amounts, units, numeric ratings, and chip-key arrays for both service and space.
- FAIL-before on original production sources: 1 test failed, reporting the three missing-schema references plus seven unused `@ts-expect-error` directives, proving the fields had lost type safety. PASS-after: 1 test passed with no compiler diagnostics.

Command: `pnpm test src/shared/api/__tests__/contribution-contract.test.ts`.

Raw logs: `/tmp/mobile-g04-f01-before.log`, `/tmp/mobile-g04-f01-after.log`.

## F-02 — ordered, confirmed quick-save

- `src/features/tabs/saved-link.view.tsx:39` always awaits the save mutation; it no longer decides from a pre-resolution saved-list snapshot.
- `src/shared/api/queries/use-me.ts:138` queues mutations by QueryClient and target type/ID. The turn covers optimistic updates, network retries, rollback and settlement. Different targets remain independent.
- Repeated saves retain one cached entry and its metadata. A rejected mutation rolls back only its target, preserving other places saved concurrently.
- `src/features/__tests__/saved-link.spec.tsx:42` removes a previously saved place during deferred resolution, then verifies PUT is invoked and success feedback waits for PUT completion.
- `src/shared/api/queries/use-saved-mutations.spec.tsx:42` covers pending DELETE → PUT, failed DELETE → PUT, PUT → later DELETE, retries, metadata preservation and concurrent-target rollback.
- FAIL-before on original production sources: 2 suites failed, 7 tests failed / 8 passed. Failures demonstrate skipped PUT, overlapping requests, duplicate entries, and rollback erasing another saved place. PASS-after, including retry coverage and adjacent existing suites: 4 suites / 26 tests passed.

Command: `pnpm test:ui --runInBand src/features/__tests__/saved-link.spec.tsx src/shared/api/queries/use-saved-mutations.spec.tsx src/features/__tests__/optimistic-rollback.spec.tsx src/shared/api/queries/use-saved-entries.spec.tsx`.

Raw logs: `/tmp/mobile-g04-f02-before.log`, `/tmp/mobile-g04-f02-after.log`.

## Current checks

| Check | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm api:check` | PASS |
| F-01 strict declaration regression | PASS, 1 test |
| Focused UI and adjacent regressions | PASS, 4 suites / 26 tests |
| `pnpm test` | FAIL, 118 suites passed / 1 failed / 1 skipped; 1,343 tests passed / 3 failed / 39 skipped |
| `git diff --check` | PASS |

The three full-unit failures are the previously reported, unchanged distribution-wrapper process-lock checks at `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, and `:258`. Direct checks still return `/bin/ps: operation not permitted` and `pgrep: Cannot get process list` / `sysmond service not found`. These are environment-blocked checks; the full suite is not green. No checks were weakened or skipped to obtain a pass.

Gate logs: `/tmp/mobile-g04-typecheck.log`, `/tmp/mobile-g04-lint.log`, `/tmp/mobile-g04-api-check.log`, `/tmp/mobile-g04-test.log`.

Stitch visual acceptance remains unverified as described in `PR-g04-saved.md:9–11`. No new visual or deployed-backend acceptance is claimed.
