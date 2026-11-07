# Group 04 — Đã lưu

Owner decisions: **2026-11-07**, revised after the simulator screenshot. Worktree baseline **3f181d8**, initially clean. No install, commit or push performed. Current-area #520 remains a rebase TODO.

## Design evidence and limits

Destination project: `17315762413421369447`. Prior design: [Đã lưu - GoGo](https://stitch.withgoogle.com/u/2/projects/17315762413421369447?node-id=6045502163558025217), screen `6045502163558025217`.

Requested new title: **Đã lưu v2 - GoGo**. This session exposes no Stitch MCP tools, including `list_screens`; tool discovery found no callable Stitch capability. Its presence or generation status could not be checked. Implementation follows the owner's written v2 spec. No v2 destination ID, HTML or screenshot was verified.

Light and Dark use the same component tree, shared PlaceCard and existing semantic theme tokens. Structural tests cover the compact row and count badges in both themes; they do not establish pixel parity. No simulator screenshot pair was captured here. Visual acceptance remains pending; no 100% design-match claim.

## Dated owner deviations (2026-11-07)

These supersede the earlier g04 plan/filter/map/share decisions:

- **Places only.** Removed Tất cả/Địa điểm/Kế hoạch chips, saved-plan cards, timeline/photo/title helpers, plan warnings, Đi ngay and their dead translations/tests. The saved-entry hook filters legacy plans before detail hydration; no plan or room detail request is made for Saved. Existing saved plans remain on the server, untouched. A response containing only plans yields the places empty state.
- Audited app save callers: every bookmark mutation targets a place. No separate save-plan bookmark action exists elsewhere at this baseline. Existing plan-edit submission saves itinerary edits and is retained. BE endpoints, generated types and saved target contract remain unchanged.
- Quick save is a single **44pt row** with link icon, “Dán link Google Maps để lưu” input and small “Lưu” button. Removed the separate title and padded card. Invalid-link feedback remains below the row.
- Existing GoGo links save immediately (already-saved places stay saved); new links open the existing add-place/import wizard with the URL prefilled. No new venue is submitted automatically.
- Compact title2 city headings and bodySmall secondary ward headings; counts are small rounded badges without parentheses. Removed current-area chips. GPS/profile area still controls ordering until #520 integration.
- **Tất cả ›** on a city row filters this screen to the user's saved places in that city, across its wards. “‹ Tất cả thành phố” returns to all groups. No map, discovery results or plan stops are involved. The filtered list uses live saved entries, including removable unavailable places.
- Overflow offers **Bỏ lưu only**; removed native sharing and share-link creation from Saved. Removal waits for sheet dismissal and retains optimistic rollback/error feedback.
- The shared Saved PlaceCard stays the reference card. Provider/moderation closure facts, taxonomy labels, price units, separate rating sources, Vietnam opening hours and GPS straight-line estimates remain.
- **Tìm quán tương tự** remains ordinary Search with the closed place's category and canonical area. Missing facts do not produce invented filters.
- Guest, empty, loading, offline and retryable list/detail-error states remain. Detail 403/404/410 stays removable. Transient detail failures retain retry.
- Successful save/unsave feedback remains an inline live region; failures use the shared ResultSheet. Header notification control and Assistant FAB remain.

## Contract and stack compatibility

After Astra F-01, `openapi/gogo.v1.yaml` retains the complete stacked contract from base `4c3961d` (**7.3.0-alpha.1**, blob `9024bd539278150895ed7c04f1777f4bded987b6`). `pnpm api:types` regenerates `src/shared/api/schema.d.ts` from that contract without hand edits; both files match the base exactly.

The base includes the contribution-draft operations, enrichment/draft schemas, and their `ContributionPrice`/`ContributionRating` dependencies already used by #516. The incomplete compatibility declaration is deleted, and `types.ts` imports the generated declarations directly. The retained contract is **not evidence the deployed BE implements drafts**. Regression evidence and current checks: [Astra finding repairs](PR-g04-astra-fixes.md).

Sources remain BFF endpoints: `/me/saved`, `/places/{id}`, `/taxonomies`, `/me/notifications`, `/places/resolve-google-maps-link`. No provider calls added. The BE saved-plan contract is retained unchanged.

Quick-save always confirms the saved state through the idempotent PUT, including already saved places. The shared mutation hook serializes each target's save/removal across hook instances, including automatic retries. Optimistic saves preserve existing metadata without duplicates; failed mutations roll back only their target. Success feedback follows the PUT response.

Telemetry reuses `place_saved` (`source=saved_link`) after successful PUT; similar Search emits its existing entry event. URLs and resolution tokens are not sent in these events.

## Prior checks at `25b9ba0` and remaining acceptance

- `pnpm typecheck`: passed on final sources/tests.
- `pnpm lint`: passed.
- Focused `pnpm test:ui --runInBand` (Saved areas, link behavior/Light+Dark styles, saved-entry hydration, i18n): **4 suites / 65 tests passed**. Shared PlaceCard suite also passed in the initial targeted run.
- Full `pnpm test:ui --runInBand`: **187 suites / 2,225 tests passed**.
- `pnpm test`: **117 suites passed, 1 failed, 1 skipped; 1,342 tests passed, 3 failed, 39 skipped**. All Saved pure tests passed. The three failures are confined to unchanged `src/shared/config/__tests__/distribute-wrapper.test.ts` process/lock checks (lines 208, 234, 258). Direct checks confirm `/bin/ps` returns `operation not permitted`; `pgrep` reports `sysmond service not found` / `Cannot get process list`. This sandbox prevents a fully green unit run. Distribution code/tests were not weakened or skipped.
- `git diff --check`: passed.
- No install, commit or push. No remote contract write tests run. BE API/schema files are unchanged.
- Remaining acceptance: callable Stitch `list_screens` lookup for the v2 title, plus Light/Dark simulator visual comparison. No DEV/backend acceptance or deployment claimed.
