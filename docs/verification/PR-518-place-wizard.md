# #518 — Three-step place contribution wizard

Refs #518. Local code, tests and review notes only; no install, commit, push,
PR publication, native build or deployment.

- Branch: `feature/GOGO-518-place-wizard`.
- Stack/base: PR #516, `c01b1ff229205791e35af5391ebdb54c5249451f`.
- Owner instruction dated 2026-11-07 explicitly authorizes implementing #518
  now. This supersedes the #518 deferral in `PR-516-group-03.md` for this task.

## Contract dependency — pre-merge vendor

`openapi/gogo.v1.yaml` is copied verbatim from
`/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/be-796/openapi/gogo.v1.yaml`.
**GoGo-BE#796 is not merged. Re-vendor the merged backend contract and regenerate
`src/shared/api/schema.d.ts` after BE#796 merges. Run `pnpm api:check` again.**
The current vendored SHA256 is
`c9ea74f45097bdb0aeff95efb51a1a45baa8e92d581c38645be27358e5c865d2`.

The client uses generated operation bodies/responses and schema types for:

- `POST /v1/place-submissions`: `enrichment`, with purposes, 1–3 vibes,
  separate service/space ratings, optional price, amenities, dishes and tips.
- `GET /v1/place-contribution-drafts` and `GET /{id}` for explicit resumption.
- `PUT /v1/place-contribution-drafts/{id}` with client UUID and `expectedVersion`.
- `DELETE /v1/place-contribution-drafts/{id}?version=...`.

Drafts contain only the provider identifier and unverified user claims. They
never contain the pasted URL, Google name/address/image, resolution token or
local photo URIs. The query persistence allowlist excludes the private draft
root; draft queries/mutations have zero cache retention after release and no
mutation retries. Conflicts require explicit GET/resume; they never silently
replace newer server data. A lost create response retains its UUID so a retry
cannot create another draft. Saving an existing place draft requires resuming
or deleting it first. Drafts are available only to registered users; guests
retain room-scoped submission behavior.

## Direct Stitch evidence

Read all three exact screens live on 2026-11-07 using the configured read-only
Stitch MCP adapter: `get_screen`, then `download_file` for both HTML and image.
Inspected all three source images and the corresponding HTML. No Stitch writes.

| Step | Project / screen | Source evidence |
| --- | --- | --- |
| 1 | `17315762413421369447` / `10756253768045112131` | Live HTML SHA matches [#516 verified HTML](PR-516-group-03-source/verified.html), with [source image](PR-516-group-03-source/verified.jpg); HTML `files/15752337466060138129`, image `files/17806848170454934078` |
| 2 | Same project / `2fd3b7e365954d6db9ef612d361a1bbf` | [HTML](PR-518-source/step-2.html), [PNG](PR-518-source/step-2.png); screen `fileEntries/html` and `fileEntries/screenshot` |
| 3 | Same project / `3d9ed7f6136a477c85c76057aafff0b4` | [HTML](PR-518-source/step-3.html), [PNG](PR-518-source/step-3.png); screen `fileEntries/html` and `fileEntries/screenshot` |

Step 2 HTML / PNG SHA256:
`cbfe3ed0031f4a45c8e9a1b5d33e65f00cb3e21bb8a134c7e55aa03d22919c0f` /
`12ef21f2682130217c394ff7aaf5765ed971fc2c7540d3b715b05706e1e6794a`.
Step 3 HTML / PNG SHA256:
`c57c64c41a3d88b08f2663b80bfc69b548df4db2941e4ec2dd40f38b145c224e` /
`9c8ee96aceb5481185ce38653dfdf7d71e1689266b5b3ddaa9313b39f92900da`.
Design samples are documentation only and are never imported into app code.

## Stitch → app mapping

Paths are repository-relative. Lines identify entry points, not pixel parity.

| Stitch element | App behavior | Files:lines |
| --- | --- | --- |
| Wizard below the extracted-data card | Independent card after the shared `PlaceCard`; also required after ambiguous branch selection, reset on link/branch changes | `src/features/place-import/import.view.tsx:550` |
| Bổ sung trải nghiệm thực tế + three progress segments | Empty initially; actual purpose/price, vibe and rating validity determines completion; current step is explicit | `src/features/place-import/contribution-wizard.view.tsx:261` |
| Credit badge | Displays actual `creditBalance` from the HTTP assistant-status API; hidden if unavailable. No sample +70 or “ready” award | `src/features/place-import/contribution-wizard.view.tsx:269` |
| Step 1: price + multiple purposes | Source price shortcuts plus explicit VND min/max/unit, free and unknown choices; purposes from `suitability` | `src/features/place-import/contribution-wizard.view.tsx:360`, `src/features/place-import/contribution-form.ts:49` |
| Step 2: Vibe & Không gian thực tế | API `mood` choices; minimum 1, maximum 3; fourth unavailable until deselecting | `src/features/place-import/contribution-wizard.view.tsx:426` |
| Step 2: six amenities | Checklist intersection of live `amenity` taxonomy and contract-supported fields; deselection omits the claim rather than asserting absence | `src/features/place-import/contribution-wizard.view.tsx:436`, `src/features/place-import/contribution-form.ts:8` |
| Step 3: menu/bill photos ≤5 | Visible disabled upload with reason; no picker, local preview, upload, fake masking or image payload | `src/features/place-import/contribution-wizard.view.tsx:470` |
| Step 3: dishes and visit tips | Optional, separate fields, limits 1,000 / 2,000 characters | `src/features/place-import/contribution-wizard.view.tsx:487` |
| Step 3: five stars + chips | Separate service/space 1–5 ratings; `checkin_tag` chips filtered by `service_` / `space_` and capped at 5 each | `src/features/place-import/contribution-wizard.view.tsx:161` |
| Quay lại / Tiếp tục sang Bước n | Preserves actual entries; forward transition validates current step; no timer/demo completion | `src/features/place-import/contribution-wizard.view.tsx:498` |
| Gửi địa điểm cho GoGo | Same existing moderation endpoint, now with validated enrichment; offline/busy/incomplete/future-opening disabled; old-token retry retains claims and refuses a changed provider identity | `src/features/place-import/import.view.tsx:221`, `src/features/place-import/contribution-wizard.view.tsx:519` |
| Lưu nháp / resume / delete | Versioned server snapshot, explicit GET resumption, conflict/limit/error handling; local text remains on failed writes | `src/features/place-import/contribution-wizard.view.tsx:195`, `src/shared/api/queries/use-contribution-drafts.ts:7`, `src/shared/api/endpoints/contribution-drafts.ts:1` |
| Quy chuẩn kiểm duyệt GoGo | Explains unverified claims and approval-only +50, with +20 only for approved menu/bill evidence; policy comes from the vendored `AssistantStatus.creditBalance` contract description | `src/features/place-import/contribution-wizard.view.tsx:602`, `src/shared/i18n/vi.ts:1086` |
| Light + Dark | Shared layout/content, existing redesign semantic roles backed by night tokens; no theme-dependent fields | `src/features/place-import/contribution-wizard.style.tsx:4` |

Taxonomy keys and localized labels come from `GET /v1/taxonomies`; unknown,
unlabelled and obsolete options are hidden. Resumed obsolete selections block
submission and have an explicit removal action. No source café, sample price,
preselected rating, uploaded photo or sample progress ships as app data.

## Deliberate differences and open dependencies

- **FAIL parity: Stitch has no Dark for these screens.** App Dark uses existing
  night tokens. Neither Light nor Dark app screenshots were captured in this
  edit/test task: measured app/source visual acceptance is **0/3, not verified**.
- Unknown price is omitted from enrichment and hidden in the provider preview,
  per the current owner instruction. Price is optional in BE#796; unlike the
  source’s required-price badge, the wizard lets the user explicitly say it is
  unknown. A “Trên 200k” selection requires entering an actual upper bound,
  because the API accepts bounded prices, not an invented open-ended maximum.
- The source’s single combined star row is split into service and space because
  BE#796 requires two distinct ratings. Neither starts preselected. Chips are
  available after selecting their corresponding rating so incomplete drafts
  cannot silently drop chips.
- Submission evidence remains blocked: #516 has a local-only picker; #793 does
  not supply a usable submission upload path, and BE#796 explicitly blocks
  nonempty evidence on #794. The disabled control explains ownership/privacy
  preparation. Enabling it requires the real approved upload/claim/masking
  contract; no generic public-media workaround is used.
- Reward amounts are an approval policy from the API contract, not a reward
  calculated from form progress. Only actual credit balance is presented as a
  current account fact. No immediate award or unverified 24-hour review SLA.
- There is no “Đóng góp của tôi” route in `src/app`. Successful submissions keep
  the existing status/polling screen, canonical-place outcome and owner-only
  status explanation. A draft can be resumed after resolving its place again;
  a global contribution/draft inbox is outside this route’s available scope.
- BE#796 must merge, be re-vendored and reach the target environment before
  backend integration acceptance. No DEV acceptance is claimed by these tests.

## Verification record

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, no errors or warnings after fixes.
- `pnpm api:types` and `pnpm api:check`: PASS.
- Full `pnpm test`: **113 suites passed, 1 failed, 1 skipped; 1,323 tests passed,
  3 failed, 39 skipped**. All three failures are in unchanged
  `src/shared/config/__tests__/distribute-wrapper.test.ts`: live owner lock,
  live recorded build group, and retained lock after child exit. Those checks
  require process inspection; this managed sandbox rejects `ps` with
  `operation not permitted`. No distribution scripts or their tests changed.
- Full `pnpm test:ui --runInBand`: **182 suites / 2,157 tests PASS**. This broad
  run preceded the final branch-switch and changed-provider regression cases.
- Final six place-import/wizard suites: **6 suites / 82 tests PASS**, including
  those added regression cases and the final form-state implementation.
- Last owner + both design-drift UI suites: **3 suites / 153 tests PASS**.
- Focused form, draft API/persistence, design-drift and dark-token Vitest:
  **4 suites / 51 tests PASS**.
- Regression sensitivity: deliberately reintroduced ×1,000 conversion into the
  price serializer; the new minor-unit assertion failed (exit 1). Restored
  correct serializer; all 51 focused tests passed afterward.
- UI source audit against `c01b1ff`: **fails=0, warns=0**.
- Existing installed Prettier formatted the new TypeScript files; no install.
- `git diff --check`: PASS.

Coverage includes empty forms, back/forward retention, actual taxonomy labels
in vi/en, empty/loading/error taxonomies, 1–3 vibe cap, integer/currency/scope
validation, partial drafts, expected versions, explicit resume/delete, conflicts,
offline/guest/busy states, stale draft completions, unavailable evidence controls,
reset on link/branch change, provider attribution, existing moderation polling,
future opening, one stale-token retry, changed provider identity and telemetry
without user text/tokens/photos.

NEEDS DEVICE CHECK: all three steps in Light/Dark, 390pt and narrow widths,
keyboard reveal for prices/dishes/tips, large text, chip wrapping, star controls,
VoiceOver/TalkBack, and comparison against the three supplied Stitch sources.

TASK GoGo-MobileApp#518 / BASE c01b1ff / HEAD unchanged / PR none
SCREENS: three wizard steps implemented; app screenshot fidelity unmeasured
AUDIT: 0 failures, 0 warnings
QUESTIONS FOR OWNER: no blocking product question; Dark source, evidence upload
and contribution-inbox route remain the documented external dependencies above.
