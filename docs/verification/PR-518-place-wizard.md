# #518 — CMS-driven place contribution wizard

Refs #518. Worktree `mobile-518`, baseline HEAD `db68229` (clean at start).
Owner's 2026-11-07 instruction authorizes this focused file/test change and
supersedes the earlier Stitch-only option mapping for this wizard. It does not
establish completion of the project-wide Stitch migration gate.
No install, commit, push, backend modification, native build, or Stitch write.

## Current behavior

Options come exclusively from `GET /v1/taxonomies`:

| Wizard group | Taxonomy kind | Selection limit |
| --- | --- | --- |
| Mục đích | suitability | 10 |
| Vibe | mood | 3 |
| Tiện ích | amenity | 6 (current BE#796 maximum properties) |
| Đánh giá chips | checkin_tag | 5 per rating |

There are no client-owned option allowlists. Entries sort by `sortOrder`, with
response order preserved for ties. The public endpoint returns active entries;
an explicit `active: false`, if supplied, is also excluded. Labels prefer the
exact API locale, then the language subtag. Existing i18n copy is a fallback
only when that locale has no API label; new keys without local copy can use the
API Vietnamese label, then the key as a last-resort missing-label indicator.
Unknown amenity keys render with the generic `activity` icon.

Collapsed groups show six chips or five amenity checklist rows. Selected values
replace unselected preview entries, preserving CMS order. If more values are
selected than the preview limit, all selections remain visible, as required.
The dashed `+N khác` chip counts hidden entries; amenities use
`Xem tất cả N tiện ích`. Both open the existing shared animated Sheet, with
search, selected count / limit, checkbox rows, and primary `Xong`. Optional
string `group` metadata is displayed when supplied; the current endpoint has
no group metadata, so no client categories are invented. Search and the list
stay inside the shared sheet's keyboard/accessibility/motion behavior.
All surfaces use shared theme tokens for Light and Dark.

Loading, fetch failure/retry, empty groups, and search with no matches have
explicit states. Missing required suitability/mood data prevents completion.
Both submission and draft writes reject keys absent from the fetched kind,
duplicates, and over-limit selections. Retired rating tags are no longer
silently dropped: users must explicitly clear unavailable draft selections.
Amenities remain omitted when unknown, including when a true selection is
unchecked; explicit false values from an old draft survive unrelated changes.
The optional shared star control retains the existing service/space payload
shape. Rating chips apply to both ratings and become selectable after rating.
Step 3 remains optional. Draft version/conflict handling and photo blocking
are unchanged.

## Live read-only evidence — 2026-11-07

Read `https://api-dev.gogo.id.vn/v1/taxonomies` directly with GET. It returned
5 suitability, 10 mood, 7 amenity, and 9 checkin_tag entries, including:

- mood: quiet_private, acoustic_music, airy_garden, cool_indoor, rooftop_view;
- suitability: photo_spot;
- checkin_tag: friendly_staff, fast_service, pleasant_music.

Called the configured Stitch MCP `list_screens` for project
`17315762413421369447`: 79 screens returned, none with the title
`Thêm địa điểm: Bước 2 · Nhiều lựa chọn - GoGo` (nor any title containing
`Nhiều`). Implemented the owner's supplied overflow-sheet specification.
No new-screen pixel parity or device acceptance is claimed.

Previously inspected source screens remain reference context:

| Step | Screen |
| --- | --- |
| 1 | 10756253768045112131 |
| 2 | 2fd3b7e365954d6db9ef612d361a1bbf |
| 3 | 3d9ed7f6136a477c85c76057aafff0b4 |

Existing HTML/images are in `PR-516-group-03-source` and `PR-518-source`.
The old fixed mapping, substituted Stitch labels, and statements that the new
CMS keys do not exist are superseded by this change and live API read.

## Backend contract blocker — not server acceptance

The vendored `openapi/gogo.v1.yaml` and the read-only local `be-796` worktree
still describe **six named amenities only**, `additionalProperties: false`,
and service_/space_ prefixes for checkin_tag keys. Its implementation at
`libs/modules/ingestion/application/contribution-enrichment.ts` still enforces
that list and those prefixes. This conflicts with the owner's CMS-driven
requirement and the live API values (e.g. wifi, friendly_staff).

This patch renders the real API values and preserves their exact keys; it does
not invent prefixed aliases, silently discard claims, or modify the backend
contract to claim support that does not exist. Client checks enforce fetched
membership and BE cardinalities (10 purposes, 3 vibes, 6 amenities, 5 tags).
**New amenities and shared unprefixed rating tags still require a BE#796
contract/validator update before end-to-end acceptance.** The current client
will send those exact selected keys; the old backend validator rejects them.
A newer backend contract was requested during implementation; none was supplied.

`openapi/gogo.v1.yaml` was originally vendored from the local `be-796` worktree.
Its recorded SHA256 remains
`c9ea74f45097bdb0aeff95efb51a1a45baa8e92d581c38645be27358e5c865d2`.
Re-vendor the merged backend contract, regenerate `schema.d.ts`, run
`pnpm api:check`, and verify real selected CMS keys against the updated server.
The older required-service/space schema also predates the owner's optional-step-3
instruction and needs reconciliation there. No submission POST was made.

## Verification

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, no diagnostics.
- `pnpm test`: **114 suites passed, 1 failed, 1 skipped; 1,328 tests passed,
  3 failed, 39 skipped**. All failures are the pre-existing distribution-wrapper
  process-inspection cases at lines 208/234/258. `ps` returns operation not
  permitted in this sandbox, matching the prior verification on this branch.
  No unrelated scripts/assertions/skips or permissions were changed to hide it.
- `pnpm test:ui --runInBand`: **182 suites / 2,163 tests PASS** before the last
  three additional wizard regressions and explicit-false preservation adjustment.
- Final affected UI rerun (wizard, owner import, resolution token, future opening):
  **4 suites / 81 tests PASS**, including all **23 wizard tests**.
- Final focused form/options/draft API: **3 suites / 17 tests PASS**.
- `git diff --check`: PASS.

New regression coverage: 40 moods, all three chip groups exceeding six options,
CMS sorting, API locale labels and i18n fallback, selected overflow visibility,
search/no matches, optional groups, max-three moods, max-five rating tags,
amenity overflow checklist, generic unknown-key icon, and explicit stale-key
clearing before writes.

Remaining acceptance: the backend contract conflict above; full Vitest process
inspection outside this restricted sandbox; device Light/Dark, keyboard,
VoiceOver and large-text review against the new Stitch screen when available.

## Owner screenshot corrections — 2026-11-07 (HEAD 4057e22)

The owner's five screenshot corrections authorize these focused deviations from
stored Stitch HTML. They do not claim completion of the wider migration or
simulator acceptance. Baseline `4057e22` was clean. Files only; no install,
commit, push, native build, backend change, or Stitch write.

- Submit and Save now use shared Primary/Secondary buttons, both full width and
  56 points high in the same parent, with identical horizontal margins. Save
  uses the design-system outlined Secondary instead of the violet Ghost style.
- Draft-list and resume reads are best-effort. Empty lists and HTTP 404 are
  silent; a 404 list ignores stale cached entries, and a missing resumed draft
  releases its stale save guard without discarding entered form values. Other
  read errors emit `place_contribution_draft_read_failed` with operation and
  numeric HTTP status (0 for non-HTTP errors), never IDs/content/messages.
  List failure no longer disables Save. Read failure never gates Submit.
  Inline draft errors are reserved for explicit Save failures; existing
  save conflict/version protection remains. Delete failures are also silent
  with status-only telemetry and preserve the conflict reload guard.
- The only credit message is the header `+50 GoGo Credit` pill with its approval
  condition. Removed credit from Submit, both step-3 reward pills, photo help,
  and the moderation note. Removed all numeric +20 hints; no bonus is promised
  while photo upload remains blocked. The nonnumeric step-3 progress label
  remains. This intentionally simplifies the stored Stitch rewards.
- Footer has no `Bước n / 3 hoàn thành` text. Back is `Quay lại`, text only;
  forward is `Tiếp tục` or `Hoàn tất`, single-line. Both share a 56-point height
  and equal flexible widths in one row. The shared default buttons provide
  single-line labels rather than the wrapping discovery variant.
- Rating renders only five interactive stars, with no score/unrated text.
  Each star retains its localized value label, checked state, and ability to
  clear the optional rating. Service/space payload behavior is unchanged.

Regression coverage includes all three wizard steps, one credit occurrence,
button geometry/single-line labels, star accessibility, empty/404/cached-404
lists, HTTP/network list failures, resume failures preserving entered data,
Submit availability, explicit save errors, and silent deletion failures.

Current verification (supersedes earlier counts above):

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, no diagnostics.
- `pnpm test`: 114 suites passed, 1 failed, 1 skipped; 1,328 tests passed,
  3 failed, 39 skipped. The same three pre-existing process-inspection cases
  fail at `distribute-wrapper.test.ts:208/234/258`. Confirmed directly that
  `ps -p $$ -o pid=` returns `operation not permitted` in this sandbox.
  No unrelated tests, scripts, skips, or permissions were changed.
- `pnpm test:ui --runInBand`: PASS, 182 suites / 2,179 tests, including all
  31 contribution-wizard tests.
- Focused `pnpm test` (form, options, draft API): PASS, 3 suites / 17 tests.
- `git diff --check`: PASS.

Remaining acceptance: simulator Light/Dark, keyboard, large-text and VoiceOver
review; the existing BE#796 contract blocker described above. No new simulator
screenshots or end-to-end server acceptance are claimed.

## Shared result sheet and My Contributions — owner 2026-11-07

Baseline `f79e416`, clean. This section supersedes the earlier inline submission
result and fixed-width star-row descriptions. Owner authorization covers this
focused implementation; it does not establish the project-wide migration gate.
No dependency install, commit, push, backend edit, native build, or Stitch write.
The referenced `RTK.md` was not present in the worktree or checked parent paths.

### Behavior

- All five stars span the content width with `space-between`. Every target
  remains 44×44 or larger; optional rating toggle and service/space payloads
  are preserved.
- `src/shared/ui/result-sheet.view.tsx` is the one reusable result component:
  success/error/warning/info, overridable icon, title/body, optional note,
  primary/secondary actions, close and post-dismiss callback. It uses the
  animated shared Sheet and semantic theme tokens in Light/Dark. The title
  receives accessibility focus after entrance and the result is announced;
  pending announcements are cancelled on close/unmount. Sheet continues to
  own reduced motion, safe areas, backdrop, Android Back, and escape behavior.
- Queued submissions show the Mint success result with place name, notification
  copy, one small conditional +50 credit line, and the two owner actions.
  `Xem đóng góp của tôi` uses `router.replace('/me/contributions')` after native
  sheet dismissal, removing the submitted import route from Back history.
  Backdrop/Back/escape on success take the same path. `Thêm địa điểm khác`
  resets to the empty link step after dismissal. Existing canonical-place
  responses retain their existing-place action instead of falsely promising
  a moderation review or reward.
- Submission errors show the error result, with safe localized text and the
  form-retention sentence. Retry resends the captured enrichment; Save Draft
  invokes the existing versioned draft save. The wizard stays mounted, including
  on network failure during stale-token revalidation. Draft login, validation,
  existing-draft and version-conflict protections remain in force. Actions run
  after dismissal to avoid overlapping native modals. Raw server errors are
  never displayed. The prior inline submitted/pending text and polling are gone.
- `/me/contributions` and the Cá nhân settings entry read the authenticated
  account's submissions. Cards include photo/placeholder, fallback name,
  `Gửi ngày dd/MM/yyyy`, icon + localized status, public rejection-key text,
  and place navigation only for approved/merged rows with `placeId`.
- All/Pending/Approved/Rejected chips filter loaded pages; Approved includes
  merged. The server has **no status query parameter**. Cursor loading remains
  available under every filter, and an empty filtered partial list explicitly
  says to load more. No complete-list count or false terminal empty claim.
  Pull-to-refresh re-fetches current decisions. Loading, offline, empty,
  initial/refresh/page errors, retry, sign-in gate, and the primary add-place CTA
  are present. Existing cards remain visible on refresh/page failure.
- Private contribution queries are memory-only (`gcTime: 0`, no persistence
  allowlist match). The list endpoint itself returns approved catalogue photo
  URLs only; the image uses `cachePolicy="none"`.

### Contract and design evidence

Vendored only `/me/place-submissions`, `MyPlaceSubmissionsPage`, and
`MyPlaceSubmission` from the read-only local `be-797/openapi/gogo.v1.yaml`,
which contains the BE#795 endpoint. Source SHA256:
`dfa9f14fd0a98b23c0cc6c31f1cf236f460d30c2379ef137774a5139620a4d99`.
Reused the existing `SubmissionRejectionReason` enum and regenerated
`src/shared/api/schema.d.ts`. This is an additive contract import, not a full
backend-contract refresh. The earlier BE#796 taxonomy validator blocker still
requires independent reconciliation; no authenticated DEV request or POST was
made for this change.

Stitch `list_screens` is not exposed by this session's tool inventory. No saved
artifact for `Gửi địa điểm: Kết quả - GoGo` or screen
`9dcc2716e2d04f53a869b059a2738268` was found in this worktree. Both screens use
the owner's written specification and existing shared mobile components.
**Unavailability is not evidence that the generating result screen is absent.**
A later read must inspect that title and the mobile content of
`Đóng góp của tôi - GoGo` in project `17315762413421369447`. No Stitch parity,
simulator, Light/Dark device, VoiceOver, large-text, or server acceptance is claimed.

### Later adoption of ResultSheet (outside this PR)

Keep destructive confirmation dialogs separate. Existing informational/result
feedback candidates for follow-up:

- Create-date save failures and sign-in prompts:
  `src/features/create-date/save-draft.view.tsx`,
  `wizard-actions.view.tsx`, and `draft-resume.view.tsx` (`Alert.alert`).
- Account save success/failure notices in
  `src/features/account/account.view.tsx`.
- Contribution draft save/conflict/failure notices in
  `src/features/place-import/contribution-wizard.view.tsx`.
- Add-place credit-policy informational alert in
  `src/features/place-import/import.view.tsx`.

These call sites are inventoried only; no migrations are included here.

### Current verification

- `pnpm typecheck`: PASS on the final code and tests.
- `pnpm lint`: PASS, no diagnostics on the final code and tests.
- `pnpm api:check`: PASS; generated types match the additive vendored contract.
- `pnpm test`: **115 suites passed, 1 failed, 1 skipped; 1,329 tests passed,
  3 failed, 39 skipped**. Only the same pre-existing
  `distribute-wrapper.test.ts:208/234/258` process-inspection cases fail.
  Reconfirmed `ps -p $$ -o pid=` is denied with `operation not permitted`.
  No tests were skipped, weakened, or changed to hide this environment limit.
- `pnpm test:ui --runInBand`: **184 suites / 2,197 tests PASS** on the final tree.
- `git diff --check`: PASS.

Regression coverage includes all four shared result variants, action and close
callbacks, title announcement and cancellation, full-width star geometry,
success replace/reset, retry payload identity, draft-save preservation,
revalidation network failure, no obsolete owner-only polling, contribution
filters (including merged), public reason translation, photo placeholders,
place/add navigation, cursor loading under an empty filter, pull-to-refresh,
loading/empty/error/sign-in states, private API transport, and persistence
exclusion. The earlier backend-validator and device/design acceptance items
remain open; the sandbox process-inspection limitation prevents claiming that
all of `pnpm test` is green.

## Owner simulator corrections — 2026-11-07

Owner feedback in this worktree (`f9676b3`, initially clean) authorizes these
focused changes:

- The header reward is a single-line `+50` pill with the existing `sparkle`
  credit-benefit icon from `ImportGuide`. Its accessibility label and the
  success sheet note retain `+50 GoGo Credit khi được duyệt` (localized in EN).
- There is one primary wizard action: `Tiếp tục` on steps 1–2, gated by the
  current required fields, then `Gửi địa điểm cho GoGo` on optional step 3,
  gated by both required steps and the existing online/taxonomy/submit guards.
  The outer submit and `Hoàn tất` duplicates are removed. `Lưu nháp` stays
  secondary; `Quay lại` appears from step 2 as a text action on its own row,
  leaving the primary label full width.
- `ResultSheet.media` is an optional generic React content slot before the
  message. Success supplies the selected/resolved place through the existing
  `PlaceCard` preview's compact presentation: thumbnail when available, name,
  single-line address, and provider photo attribution. Missing or failed photos
  are omitted; provider bytes use the existing validated photo loader and
  `cachePolicy="none"`. No add-place fields were added to `ResultSheet`.
- Result actions share one row with equal flexible widths, primary/secondary
  hierarchy, wrapping labels, and a minimum height that can grow with text.
  Success still navigates through sheet dismissal; retry/draft data is retained.

Regression coverage: one primary action at each step, required-field gating,
back-navigation retention, empty optional-step submission, compact accessible
reward, arbitrary media ordering, equal-width result actions, submitted identity
and address, photo attribution/thumbnail/error fallback, branch changes, and the
existing retry/draft behavior. Device/simulator, VoiceOver, large-text and
Light/Dark visual acceptance have not been rerun in this edit-only task.

### Verification for the owner corrections (2026-11-07)

- FAIL-before: the updated regression cases for the sole primary action,
  generic media slot/action layout, and submitted-place row all fail against
  `f9676b3` (3/3), for the expected missing/duplicate UI. Implementation files
  were temporarily read from HEAD for this check and restored byte-for-byte;
  no checkout, commit, install, or push was performed.
- `pnpm typecheck`: PASS, exit 0.
- `pnpm lint`: PASS, exit 0, no diagnostics.
- `pnpm test:ui --runInBand`: PASS, **184 suites / 2,202 tests** on the final
  implementation and tests, including the three FAIL-before regressions.
- `pnpm test`: **115 suites passed, 1 failed, 1 skipped; 1,329 tests passed,
  3 failed, 39 skipped**. The same unchanged process-inspection cases in
  `src/shared/config/__tests__/distribute-wrapper.test.ts:208/234/258` fail
  because this sandbox denies `ps` (`ps -p $$ -o pid=` returns
  `operation not permitted`). The distribution tests and scripts have no diff
  from HEAD. This environment blocker prevents claiming the command is green;
  no tests were skipped or weakened to hide it.
- `git diff --check`: PASS.

Local logs: `/tmp/mobile518-regression-before.log`,
`/tmp/mobile518-typecheck-final.log`, `/tmp/mobile518-lint-final.log`,
`/tmp/mobile518-ui-final.log`, `/tmp/mobile518-test.log`.

## Astra r4 F-05 — deleted draft media (2026-11-07)

Refs #518 / PR #522. Baseline `efbfeff` was clean. The owner's focused fix
request authorizes this edit and the requested local gates; no install, commit,
push, backend change, native build, or device acceptance was performed.

After deleting the resumed draft successfully, the wizard clears its photo
references and `billPhotoPublicConsent` while preserving price, taxonomy,
amenity, rating and text inputs. The deleted ID is excluded locally while the
draft query refreshes, so cached entries cannot block saving a new draft.
Failed deletion preserves the original media, consent and versioned identity.
The API contract and existing content-free deletion telemetry are unchanged.

Regression evidence in `/private/tmp/mobile-522-r4-evidence/`:

- `regression-before.log`: against unchanged production code at `efbfeff`,
  the two success-path tests fail: saving is blocked by the cached deleted
  draft, and submission contains the expired menu/bill IDs and consent.
  The failed-deletion control passes.
- `regression-after.log`: all 39 wizard tests pass, including all three F-05
  cases and the existing photo-retention regression for drafts still alive.
- `typecheck.log` and `lint.log`: PASS, exit 0.
- `unit.log`: exit 1; 119 suites passed, 1 failed, 1 skipped; 1,360 tests passed,
  3 failed, 39 skipped. Failures are unchanged distribution-wrapper cases at
  lines 208/234/258. `process-inspection.log` confirms this sandbox denies `ps`;
  the wrapper tests and distribution scripts have no diff from HEAD.
- `ui.log`: `pnpm test:ui --runInBand` PASS, exit 0; all 188 suites / 2,235 tests.

No full-suite green result, independent re-review or device acceptance is
claimed. Revert this section and the focused wizard/test changes to roll back.
