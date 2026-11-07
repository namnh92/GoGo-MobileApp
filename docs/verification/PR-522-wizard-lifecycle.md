# PR #522 — Import-flow lifecycle T1–T12

Refs #518, PR #522. Baseline `b4ca8b3` on `feature/GOGO-518-place-wizard`.
Implements the owner's authoritative SA shape in
`dev/handoffs/sa-shape-mobile-522-wizard-lifecycle.astra.md` against vendored
OpenAPI `7.5.0-alpha.1`. No dependency installation, workspace commit, push,
backend change, native build, or deployment was performed.

Source/test review basis: **`rs-d63be9c52d2d`**, created before the final gates.
Manifest and retrievable patch/files:
`/tmp/mobile522-lifecycle-rs-d63be9c52d2d/MANIFEST.txt`.
Scope is `src`; generated evidence and this report are outside that scope.

## Ownership and boundaries

`ImportFlowProvider` mounts one `ImportFlowController` above resolution, wizard,
and results. One reducer owns link/candidate/proof, non-media fields, active
identity, immutable pending writes, media, exact bill-set acknowledgement,
list revisions/tombstones, result, and cleanup. RHF is a controlled adapter for
non-media fields only. Save/submit serialize reducer state. Draft and submit
requests are imperative BFF calls: they do not independently write mutation or
query caches after a generation has been abandoned.

Foreground effects capture epoch/generation/operation/target before awaiting;
list reads additionally use request sequence and mutation revision. Expiry,
confirmed absence and active deletion share one atomic detach. Recovery depends
on phase/active identity even when list reads fail or omit the active row.
New uploads remain visibly disabled. Local removal works offline. Copy is
localized in both Vietnamese and English. Draft telemetry contains operation/status
only; existing import analytics retains place IDs. Neither includes draft IDs,
tokens, media IDs, server messages or entered text.

## Transition → files:lines

All paths below are relative to `src/features/place-import/`.

| Transition | Implementation | UI / adapter |
| --- | --- | --- |
| T1 Create | `import-flow.ts:58` initial state; `:164` reset/select | `import-flow-controller.tsx:7`; `contribution-wizard.view.tsx:50` |
| T2 Resume 200 | `import-flow.ts:89` atomic install; `:196` confirmation; `:212` guarded GET | `contribution-wizard.view.tsx:495` identity-based recovery; `:511` replacement confirmation |
| T3 Absent/expired | `import-flow.ts:85` detach; `:120` tombstone; `:204` expiry; `:212` GET | `import-flow-controller.tsx:28` open-draft timer; `contribution-wizard.view.tsx:484` no-photo recovery |
| T4 Edit/save | `import-flow.ts:75` serialization; `:114` edit/media/ack; `:260` PUT; `:289` uncertain PUT GET | `contribution-wizard.view.tsx:50` controlled form; `:174` save; `:459` write guard |
| T5 Conflict | `import-flow.ts:244` quarantine; `:192` start-new detach | `contribution-wizard.view.tsx:183` submit guard; `:487` start-new; `:495` reload |
| T6 Invalid media / consent | `import-flow.ts:247` separate error classification and removal | `contribution-wizard.view.tsx:470` acknowledgement/removal; `:484` no-photo recovery |
| T7 Discard/delete | `import-flow.ts:309` exact target/version; pending creation reconciles first | `contribution-wizard.view.tsx:489` local discard; `:498` active delete; `:501` other rows |
| T8 DELETE 404/conflict | `import-flow.ts:338` GET reconciliation, never automatic version adoption/deletion | `contribution-wizard.view.tsx:493` retry retains exact failed target; `:495` explicit reload |
| T9 List refresh | `import-flow.ts:358` sequence/revision/tombstones; `:382` targeted presence GET | `contribution-wizard.view.tsx:465` visible list error/retry |
| T10 Accepted submit | `import-flow.ts:398` frozen POST/bounded proof retry; `:124` immediate retirement; `:444` exact-version cleanup | `import.view.tsx:97` provider; `:510` persistent cleanup recovery; `:550` result sheet |
| T11 Incomplete retirement | `import-flow.ts:338` changed-version review; `:444` cleanup; `:461` retry; `:468` explicit review/delete | `import.view.tsx:510`; `cleanup-review.view.tsx:10` read-only newer claims |
| T12 Other submit results | `import-flow.ts:398` ALREADY_EXISTS/known rejection/unknown outcome | `contribution-wizard.view.tsx:183`; `import.view.tsx:550` check-contributions action, no blind retry |
| T13 **Deferred** | **Single integration point:** `import-flow-controller.tsx:20` | Requires #525's shared transport epoch/cancellation; no user-ID/key substitute implemented |

## Required scenario matrix

Before evidence used original `b4ca8b3` production versions of the import screen,
wizard and contribution-form helper, with the new tests and transport fixtures.
Those files were restored in a `finally` block. The same regression assertions
then ran against the implementation. **14 probes failed before; three preserved
invariants already passed.** A pre-existing invariant is reported honestly as
PASS-before, not fabricated as a failing regression.

`U` = `src/features/place-import/import-flow.test.ts`.
`W` = `src/features/__tests__/contribution-wizard.spec.tsx`.
`I` = `src/features/__tests__/import-lifecycle.spec.tsx`.

| Row | Scenario | Before → after | Evidence |
| --- | --- | --- | --- |
| M01 | Resume menu/bill → edit → save; returned version installed | PASS → PASS, preserved | U:38, W:194, I:102 |
| M02 | Bill-set changes/missing acknowledgement | FAIL → PASS | W:686; U:46, U:54 |
| M03 | Active GET 404 → save/submit; detach identity/media/ack/captures | FAIL → PASS | W:697; U:62 |
| M04 | Another missing draft leaves active inputs/media/ack intact | PASS → PASS, preserved | W:710; U:70 |
| M05 | Active delete detaches; another row delete preserves active state | PASS → PASS, preserved | W:723; U:84 |
| M06 | DELETE 404 → GET 200 / GET 404 | FAIL → PASS | W:737; U:99 (both branches) |
| M07 | Open expiry; omitted active ID triggers GET without replacing edits | FAIL → PASS | W:747; U:109, U:115; U:251 rejects stale listed expiry |
| M08 | 409; repeated taps; frozen pending fields; old-generation completion | FAIL → PASS | W:756; U:125, U:134, U:209 |
| M09 | Invalid/expired/foreign media on save or submit; usable no-photo recovery | FAIL → PASS | W:768 (both media codes); U:139, U:145; I:89 |
| M10 | Create timeout after server commit; same UUID reconciled by GET | FAIL → PASS | W:777; U:148; U:155 also tests uncertain update conflict |
| M11 | Accepted POST; cleanup success/failure/absence/version change | FAIL → PASS (client) | U:159, U:167, U:174; I:51, I:63; no media-delete API exists in controller dependencies |
| M12 | Lost POST and ALREADY_EXISTS; no assumed ownership transfer | FAIL → PASS | U:186, U:192; I:74, I:84 |
| M13 | Crash/device B between POST and DELETE | **BE gap remains** | U:267 explicitly demonstrates that local tombstones do not retire device B's remote draft; no global F-07 closure |
| M14 | A→B / A→B→A / guest→user / session expiry in every async stage | **NOT RUN / deferred by owner** | T13 needs #525. U:209 and U:262 prove only flow-generation/unmount guards, not session cancellation or transport replay protection |
| M15 | Offline/list error; stale lists after deletion | FAIL → PASS | W:787; I:96; U:224, U:229, U:237; U:243 checks retry of unrelated deletion |

Additional cases cover replacement confirmation, mismatched place/ID responses,
menu-only changes preserving acknowledgement, explicit bill removal, local-only
discard, consent field errors retaining media, draft limits, known rejections,
bounded same-place proof refresh, and no stale completion after reset/unmount.

## Gate results

- `pnpm typecheck`: **PASS**, exit 0.
- `pnpm lint`: **PASS**, exit 0, no diagnostics.
- `pnpm test:ui --runInBand`: **PASS**, 189 suites / 2,253 tests.
- `pnpm test`: **exit 1**, 1,404 passed / 3 failed / 39 skipped. All three failures
  are unchanged distribution-wrapper process-inspection scenarios; `/bin/ps` is
  denied by the sandbox. Those scenarios are **BLOCKED (environment)**, and the
  overall unit gate is not green. No tests were skipped or weakened to conceal it.
- `git diff --check`: **PASS**. Post-gate source snapshot: **MATCH**.

Final source snapshot and gate summaries are recorded in
`PR-522-lifecycle-evidence/results.txt`. Full raw command logs remain at the
`/tmp/mobile522-gate-*` paths listed there. Test logs do not establish device or
DEV acceptance. The source snapshot is verified again after the gates.

## Backend dependency and deployment verification

Read-only source check: `dev/worktrees/be-806`, clean HEAD `cce6b67f`:

- `contribution-drafts.service.ts:124` deletes only the requested owner/version;
  it calls `releaseDraft` only after a matching row was deleted.
- `submission-photos.service.ts:305` transfers retained uploads to
  `attachedToType: 'place_submission'` and the submission ID.
- `submission-photos.service.ts:456` releases only uploads whose type remains
  `contribution_draft` and whose attached ID matches the removed draft.

This source supports the intended ownership boundary. **The deployed revision
and media survival were not verified.** A read-only GET to
`https://api-dev.gogo.id.vn/v1/health` could not resolve in the execution sandbox;
the external web reader also could not access that URL. No server records,
media, or drafts were created/deleted for this check.

The fixed POST request still has no draft ID/version consumption operation.
POST followed by DELETE cannot provide atomic retirement across crashes, lost
responses, concurrent devices or session changes. **Only client F-07 handling is
implemented. Global atomic consumption remains a BE requirement. F-08/T13 also
remains open for #525.** No contract addition or server acceptance is claimed.

Rollback: revert the lifecycle source/test change together; no data migration,
backend change, upload enablement or dependency change is involved.
