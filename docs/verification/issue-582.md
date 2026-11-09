# GoGo-MobileApp #582 — Đóng góp của tôi theo Stitch

2026-11-09. Worktree `mobile-582`, branch `feature/GOGO-582-my-contributions-stitch`, base `origin/re-design` / `c0ac8fb6dec790e45c04cff46560804809c20c74`. UI only; no API, generated types, dependency or native changes. No commit/push.

## Reference and implementation

Read the requested screen through Stitch MCP `get_screen` + `download_file` (HTML): project `17315762413421369447`, node `34b7f4b13564449ab6bf662b204c149f`, title “Đóng góp của tôi v2 - GoGo”, HTML file `3720825710675666958`. It contains two phone frames representing the Places and Reviews tabs. The screenshot-file download returned `Requested entity was not found`; the layout measurements below come from the retrieved HTML. No Stitch screen was modified.

- Shared `ContributionPlaceCard`: 24pt card radius, 12pt padding, 176pt photo with 16pt radius, one moderation badge over the photo, name/address, rejection reason and submitted date. Rejected records retain the real supplement route. No saved-place control, locked-save explanation, opening-hours row or duplicate footer status. `PlaceCardLarge` remains untouched.
- Shared `ContributionReviewCard`: 24pt card radius, 16pt padding, 48pt place thumbnail with neutral placeholder, name/address and status in the top row, 16pt rating stars/date below, text clamped to two lines, rejection reason. Published reviews display “Đã hiển thị”; pending reviews display “Chờ duyệt”. A removed review stays visible when returned.
- Shared parts: `PlacePhoto`, `Badge`, `RatingChips`, `Text`, `Skeleton`, plus the existing `useCardData` / `CardImage` provider loader. Photo proxy credits remain authoritative; snapshot attribution already represented in the photo credit is not printed again. `RatingStars` is a shared component.
- `/me/place-submissions` remains cursor-paginated, deduplicated and refreshable. Pending/rejected records retain bounded per-ID hydration, fallback identity, safe Maps links and transient-error retry. Approved/merged records use canonical detail. Provider snapshots supply the lazy photo and independent Google rating/count.
- `/me/reviews` remains the existing authenticated query. Catalogue detail supplies only the place thumbnail or missing place facts; it is never treated as a review attachment.
- Count badges in the segmented track, neutral status chips in Stitch order, full-width add-place CTA and the existing shared tab dock (Profile selected). Each tab has its own shaped loading skeleton, real empty state, error/retry and offline behavior. No empty-state preview panel is mixed into populated lists.
- Every view has a co-located style file. All colors use existing AppToken roles, including Dark; vi/en copy is localized.

## Fixture and API gap

`test/fixtures/my-reviews-full-case.json` is the raw JSON array expected by `GET /me/reviews`: one published, pending, rejected and removed review, verified-context fields, dates, ratings, helpful counts, long text and a rejection reason. The tests import this file and check that every property belongs to the generated `MyReview` type.

**The requested “with photos / without photos” response fixture cannot be represented by the current contract.** `MyReview` (`openapi/gogo.v1.yaml:16166`) has no photo/attachment field. This was verified against the vendored schema used by this worktree. The existing [GoGo-BE#752](https://github.com/namnh92/GoGo-BE/issues/752) explicitly tracks missing review attachments and was verified open through GitHub on 2026-11-09. No duplicate issue or API field was invented.

The shared card accepts user-photo presentation props and has Light/Dark component coverage for zero photos and five photos (three 64pt tiles, `+2 ảnh` over the third). These are component-only test inputs, separate from the contract fixture. The screen cannot pass real user attachments until the BFF contract exposes them. Serving the fixture through a local proxy will verify review text, statuses, counts, dates, rejection and empty/error behavior, but will not verify an attachment strip in the running screen.

## Remaining Stitch differences / acceptance

| Element | Disposition |
| --- | --- |
| User-review attachments / `+N` in the actual list | Blocked by the API gap above. Card layout tested separately; response fixture contains no invented fields. |
| Provider rating and photo/source credit | Kept when real data exists, per owner #582 instruction to retain #578 snapshot photo/Google rating. No duplicate credit. Missing real facts are omitted or get the shared photo placeholder. |
| Submission counts before all cursor pages load | Distinct loaded count with `+`, including filters. The endpoint has no total/status counts. Load more remains available even for an empty loaded filter. |
| Merged submissions, removed reviews, plan reviews | Preserve real server states/targets absent from the three sample cards. Merged is included in approved filter; removed has an additional filter only when returned. |
| Supplement without a safe source URL | Disabled with a localized reason. The UI does not reconstruct an original URL. |
| Header title / bell | Existing shared left-aligned header and `showNotifications={false}` retained. Left alignment is the dated owner exception in #535 (2026-11-08); profile-subscreen bell suppression is inherited from #542 (`c947c80`, 2026-11-08). The source has a centered title and bell. |
| Token colors / minimum targets | Existing semantic palette and 44pt touch targets apply. Owner 2026-11-08 AppToken decision supersedes screen-specific hex values; Dark follows token roles per owner 2026-11-07 and the current #582 instruction. |
| Empty-state preview caption | Design annotation is not rendered. The actual icon/message/action appear only when the active list/filter is empty. |
| 100% visual parity | **Not certified: 0/2 tab states compared side by side with running-app screenshots in Light and Dark.** No simulator build or screenshot acceptance was performed in this worktree. Owner/Claude sim check remains required. |

The workspace-wide ledger is outside the writable roots; this file is the local deviation handoff for `dev/handoffs/mobile-redesign-stitch-map.md`.

## Verification

- `pnpm typecheck`: exit 0, `/tmp/582-typecheck.log`.
- `pnpm lint`: exit 0, no errors or warnings, `/tmp/582-lint.log`.
- Focused contribution regressions: 6 suites / 65 tests passed before the final locale-date change, `/tmp/582-focused.log`. This is supplemental evidence; the final full suite below is authoritative.
- Final `pnpm test:ui --runInBand`, no test filter: exit 0; 219 suites / 2996 tests / 9 snapshots passed; `/tmp/582-test-ui.log`.
- `git diff --check`: exit 0.

The first full UI run exposed six old assertions expecting the deliberately removed duplicate footer status. Those assertions were corrected to require the photo badge and absence of the duplicate. The final run is recorded separately above.

## Main code pointers

- `src/features/contributions/my-contributions.view.tsx:37`: real submission adapter; `:83`: review adapter; `:95`: lists, segments, filters and states.
- `src/features/contributions/my-contributions.style.tsx:3`: screen geometry and token roles.
- `src/shared/ui/contribution-place-card.view.tsx:24` and `contribution-place-card.style.tsx:3`: dedicated place contribution card.
- `src/shared/ui/contribution-review-card.view.tsx:23` and `contribution-review-card.style.tsx:4`: dedicated review card.
- `src/shared/ui/contribution-card.view.tsx:10`: reason, deduplicated credits and skeletons; `contribution-card.style.tsx:3` shared surfaces.
- `src/shared/ui/rating-stars.view.tsx:7`: individual review rating.
- `src/features/__tests__/my-contributions-reviews.cases.tsx:23`: common Light/Dark fixture and photo-layout scenarios, invoked by both review spec entrypoints.
- `test/fixtures/my-reviews-full-case.json:1`: proxy fixture.

Existing route tagging and query/error instrumentation remain in their shared layers. Rollback is reverting the local UI diff; no server migration or data change is involved.

## Owner follow-up — whole review card navigation (2026-11-09)

- Moved the existing place action from the review identity row to the entire `ContributionReviewCard` surface. The card is a button labelled with the place name whenever a place target exists; reviews without a place remain non-interactive. The screen keeps its existing `/places/[placeId]` route with the reviewed place ID for every review status.
- Review photos currently have no viewer/action in this component or attachment field in `/me/reviews`; their presentation remains unchanged. `ContributionPlaceCard` retains its single `onPress` seam. Pending/rejected submission detail routing belongs to #570 and is not added here.
- Added Light/Dark regression coverage for all four review statuses, whole-card accessibility/navigation, and reviews without a place. Before the fix: 8 intended failures (card lacked button role), 10 passes; `/tmp/582b-regression-before.log`.
- `pnpm typecheck` and `pnpm lint`: exit 0; `/tmp/582b-typecheck.log`, `/tmp/582b-lint.log`.
- Full `pnpm test:ui --runInBand`, no filter: exit 0; 219 suites, 3006 tests, 9 snapshots passed; `/tmp/582b-test-ui.log`. `git diff --check`: exit 0. Existing uncommitted work retained; no commit/push.

## Owner follow-up — photo overlays and loading (2026-11-09, 582c)

- Moved the submitted date to a small top-right photo pill and consolidated provider/source credits into a bottom-left photo caption. Both use the shared `overlay.scrimText` / `onDark.strong` roles; measured worst-case contrast over a white photo exceeds 4.5:1 in Light and Dark. Credits retain author/source links and deduplication. Credit links stop propagation to the enclosing place action.
- Kept the status in Stitch's top-left position (reference `issue-533-source/places.html`, `top-3 left-3`). Status and date share a wrapping row with a gap, with the date aligned right when wrapping is needed. Removed the date/footer divider for non-rejected cards and the old credit block below the photo. Rejection/supplement behavior is retained.
- Added the shared `PhotoSkeleton`: a native-driver gradient shimmer that fills the existing photo frame. It stays static until the OS confirms motion is allowed and stops if reduced motion turns on. Decode completion removes the shimmer; errors/no-photo retain the existing neutral pin tile. Provider-photo fetches also show the skeleton before a URI is available.
- The existing `place-photo.spec.tsx` explicitly requires a loading pin, so this follows the owner's permitted opt-in fallback: `PlacePhoto.loadingSkeleton`, passed through `CardImage`, enabled for `ContributionPlaceCard`. Other callers retain their established placeholder behavior.
- Added shared Light/Dark component cases for all four moderation statuses, single date/credit placement, caption links, missing facts, provider fetch, decode/load/error, static unknown/reduced motion, live reduced-motion changes and AA contrast. These tests verify render trees/styles; physical layout at large font scales and simulator visual acceptance were not measured in this follow-up.
- No commit/push; UI only, no API/dependency/native changes.
- Final checks: `pnpm typecheck` exit 0 (`/tmp/582c-typecheck.log`); `pnpm lint` exit 0, no warnings (`/tmp/582c-lint.log`); full `pnpm test:ui --runInBand` without a filter exit 0, 221 suites / 3028 tests / 9 snapshots passed (`/tmp/582c-test-ui.log`). `git diff --check` passed. An earlier UI run was deliberately interrupted after final link/animation refinements; its partial output is `/tmp/582c-test-ui-initial.log`, not acceptance evidence.
