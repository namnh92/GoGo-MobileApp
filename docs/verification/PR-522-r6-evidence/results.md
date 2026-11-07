# PR #522 — Astra r6 fixes and reconciliation audit

Refs #518. Worktree `mobile-518`, branch `feature/GOGO-518-place-wizard`.
Baseline HEAD remains `a20b8e7f253f4080cbee42eb2bd0ddab7b786733`.
Owner instruction of 2026-11-07 authorizes these fixes within the existing
SA design in `/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/sa-shape-mobile-522-wizard-lifecycle.astra.md`.
Requested role: Sol 6.1 HIGH; no subagents. No install, commit, push, API/contract
change, native build, deployment, or external message.

Source review basis: **rs-8c4f1da43b58**, scope `src`, recorded in
[source-manifest.txt](source-manifest.txt). Retrievable source patch:
`/tmp/mobile522-r6-final-rs-8c4f1da43b58/tracked.diff`.
Evidence/docs are outside this source snapshot's scope.

## Finding disposition

| Finding | Implementation | Regression proof |
|---|---|---|
| F-09 P1 | `import-flow.ts:123,297`: reconcile confirmed identity/version/list while keeping current fields, media and acknowledgement. A local input revision detects even edits omitted or normalized by serialization, keeping replacement confirmation required. Ordinary successful PUT still installs its response with pending edits frozen. | `import-flow.test.ts:149,155,182`: uncertain create/update, later text, bill removal, cancel/confirm replacement, hidden price/trimmed text. `contribution-wizard.spec.tsx:826`: controlled input and bill removal survive GET; visible replacement prompt; later PUT uses reconciled version and omits bill consent. |
| F-06 P2 | `import-flow.ts:87` and `contribution-wizard.view.tsx:59,175,460`: detach records permission to create a fresh draft. Old remote rows remain visible and are never deleted to enable Save. Install/resume/reset clears this choice. | `contribution-wizard.spec.tsx:87,105`: Start new → Save, plus active delete/404/expiry → Save with another remote row still present. Fresh UUID, expectedVersion 0, preserved fields; no unintended DELETE. |
| F-10 P2 | `import-flow.ts:312,388`: a matching GET with different enrichment resolves uncertainty into a conflict with known identity, preserving local inputs and quarantining writes. List refresh routes pending uncertainty through the same targeted GET. A mismatched ID/place is not reconciliation proof and retains uncertainty. | `import-flow.test.ts:171,199,211,219`: uncertain create/update conflict → Start new → fresh Save, list reconciliation, untrusted/failed GET, and conflict reload absence/expiry. |
| F-11 P2 | `import-flow.ts:435`: resolution failure after explicit token rejection returns to editable state without captured payload or cleanup. Only an actually uncertain POST quarantines the flow. `:447` captures the second POST's refreshed token with frozen enrichment. | `import-flow.test.ts:288,299,313`: resolution network/503/400 failures allow Save/retry; second POST accepted/rejected/lost; wrong place, no token, unresolved and offline prevent a second POST. |

## FAIL-before / PASS-after

An isolated `git archive HEAD` of **a20b8e7** in
`/tmp/mobile-522-r6-baseline-pk8on_o5` reused the already-installed dependency
directory through a symlink. Only the final two regression test files were
copied into it. Production source stayed at a20b8e7; the working tree was never
reverted. No install was run.

- `pnpm test src/features/place-import/import-flow.test.ts`: baseline **14 FAIL,
  56 PASS**; final **70 PASS**. See [before-unit.txt](before-unit.txt) and
  [after-unit.txt](after-unit.txt).
- `pnpm test:ui --runInBand src/features/__tests__/contribution-wizard.spec.tsx`:
  baseline **5 FAIL, 50 PASS**; final **55 PASS**. See
  [before-ui.txt](before-ui.txt) and [after-ui.txt](after-ui.txt).
- Every named r6 finding has a baseline failure for the reported behavior.
  Cases that already passed, such as known 400 resolution failure, are retained
  sibling invariants and are not counted as newly reproduced bugs.

## Reconciliation paths audited

| Path / SA transition | Cases checked and preserved outcome |
|---|---|
| `save` / `reconcileSave` — T4 | Create and update share frozen UUID/request; foreground edits/taps blocked. Exact GET with/without later edits preserves current inputs/media/ack, installs identity/version, and keeps dirty replacement confirmation when needed. Different enrichment enters explicit conflict; 404/expiry detaches; failed/foreign GET retains uncertainty. Save/delete reconciliation never blindly repeats PUT or deletes. |
| `resume` — T2/T3/T5 | Dirty replacement requires confirmation; cancel preserves local data. Explicit confirmation replaces the whole snapshot without merging photos. Active 404/expired conflict reload returns to editing and clears identity/media/ack/captured payload; failed/absent unrelated resume preserves the active form and phase. |
| `refreshList` / `probeActive` — T9 | Lists only update list state. Pending uncertainty uses targeted reconciliation, not a list-derived conflict. Missing/older row triggers GET without overwriting edits; newer version quarantines writes. List failure proves no absence. Mutation revisions, sequences and tombstones reject stale results. |
| `startNew` / detach — T3/T5/T7 | Explicit new draft and successful active deletion/absence/expiry clear draft ownership, media, ack, pending UUID and captured payload atomically, retaining text. Fresh Save remains usable with sibling remote rows present. Choice survives list refresh and resets on install/flow reset. No remote deletion for Start new. |
| `deleteDraft` / `reconcileDelete(false)` — T7/T8 | Active vs unrelated deletion; local discard; uncertain creation is read first. DELETE 404 → GET 200 requires explicit conflict review; GET 404 confirms absence; expired GET detaches active ownership. No automatic delete of discovered version. Retry keeps its original unrelated target. |
| `submit` / token refresh — T6/T12 | Initial lost POST quarantines and blocks save/replay/delete/detach; ALREADY_EXISTS without acceptance retains ownership. Known rejection stays editable except explicit media recovery. Token rejection allows one same-place re-resolution and frozen-payload retry; resolution failure itself is never uncertain POST. Second POST accepted, known rejected or lost is classified independently and captures its exact request. |
| `ACCEPTED` / `cleanup` / `reconcileDelete(true)` — T10/T11 | Client retires before cleanup await. Failure preserves success and allows cleanup retry without POST replay. GET-confirmed absence completes; changed version requires review plus explicit deletion. No direct media delete, no unreviewed deletion of a newer remote version. |
| Lifecycle guards | Old read/save/submit/resolve/list/cleanup completions after flow reset or unmount are ignored. Offline allows local photo removal, blocks network actions. Exact bill set controls acknowledgement; invalid IDs and consent rejection have distinct recovery. |

Audit found and fixed sibling cases: form-only edits losing dirty confirmation;
list-triggered uncertainty getting stuck; reconciled create conflict lacking active
identity for later absence; expiry reload restoring conflict phase after detach;
DELETE reconciliation retaining expired ownership; detached Save blocked by a
sibling row; and an uncertain second POST retaining the first token's snapshot.

T13 transport/session-epoch integration remains the existing **#525 dependency**.
Global atomic draft retirement remains the SA-documented **BE dependency**;
client cleanup and simulated device-B evidence do not close it. No deployed-BE
or device acceptance is claimed.

## Final gates

Final source gate results are recorded in [gates.txt](gates.txt).

- `pnpm typecheck`: PASS, exit 0.
- `pnpm lint`: PASS, exit 0.
- `pnpm test`: exit 1, **1430 PASS / 3 FAIL / 39 skipped**; 120 passed files,
  1 failed file, 1 skipped file. All 70 lifecycle tests pass.
- `pnpm test:ui --runInBand`: PASS, exit 0: **189 suites / 2258 tests**.
- `git diff --check`: PASS.
- Source snapshot verification after gates: **MATCH rs-8c4f1da43b58**.

The full unit gate is **not green**. Its three failures are unchanged
`src/shared/config/__tests__/distribute-wrapper.test.ts:208,234,258`, testing
live process-group detection. The same three fail against isolated a20b8e7
(23 PASS / 3 FAIL): [baseline-environment.txt](baseline-environment.txt).
Direct probe `/bin/ps -o pgid= -p $$` returns `operation not permitted` (exit 127)
in this sandbox. Classified **BLOCKED by environment**; no distribution code or
test was changed, skipped or weakened.
