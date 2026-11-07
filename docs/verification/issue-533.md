# Issue #533 — My contributions v2

Worktree: `feature/GOGO-533-my-contributions-v2`, stacked on Profile #530 at `f544a4b`. No commit or push.

## Reference and implementation

Read the owner issue body from the supplied offline scratchpad. Retrieved both sources through Stitch MCP on 2026-11-08, project `17315762413421369447`:

- Places: `3b383c779a7b4e41925a8a209cce3cc7`, “Đóng góp của tôi v2 - GoGo”, 780 × 2758. HTML: [places.html](issue-533-source/places.html).
- Reviews: `bef0f4bd44ba45d6aeef17000649f26a`, “Đóng góp của tôi v2 · Đánh giá - GoGo”, 2560 × 3824, pinned phone column. HTML: [reviews.html](issue-533-source/reviews.html).

The screen reuses `useMyPlaceSubmissions`, `useMyReviews`, place detail, saved query and save mutation. Place cards use a contribution appearance in shared `PlaceCard`; review cards use their own review entity layout. Shared notification button reads real unread state. Both segments, state filters, date/status sublabels, rejected supplement link, fixed add-place CTA, empty-state preview disclosure and the four navigation destinations have real handlers or a visible unavailable reason. Profile has one contributions settings row; its review shortcut opens the reviews segment. Existing `/settings/reviews` editing remains available.

All new copy is localized in Vietnamese and English; design copy comes from Stitch. Operational unavailable reasons implement the owner's locked-action requirement. Accent fills use `accent.onAccent`; themes supply all colors. Missing place/address/photo/review text is never replaced with Stitch sample data. Real place photos retain the shared photo fallback. Provider snapshot attributions remain linked to their supplied source.

## Deviations and evidence still required

| Element | Current behavior | Reason / follow-up |
| --- | --- | --- |
| Review photo thumbnails, overflow `+n ảnh`, attachment count | Omitted | `MyReview` has no photo or attachment fields. Existing GoGo-BE#752 is referenced by the legacy reviews screen for this gap; its current remote status was not verified offline. No catalogue photo is presented as a user's review attachment. |
| Rejected submission's original link | Opens `/places/import?url=...` using the supplied `providerDisplay.googleMapsUri`; if absent, the link stays visibly unavailable with a reason | Neither `MyPlaceSubmission` nor its detail exposes the original submitted URL. The Maps URI is a real same-place link, not a reconstruction of the original URL. A backend follow-up for durable source URL exposure remains required; no new remote issue was created in this offline task. |
| Place counts before all pages load | Loaded distinct count with `+`, including filters; counts omitted before data arrives | Endpoint returns cursor pages without total/status counts. Load more and infinite scrolling remain available even when the loaded filter has no match. No sample totals. |
| Rejected/removed reviews and plan reviews absent from the populated reference | Retained when returned by `/me/reviews`; extra state filters appear only when needed | Preserve the existing real review data and statuses; do not discard historical reviews. |
| Status colors | Existing semantic status pairs, solid status badge in Light and paired dark status tokens in Dark | Token-only implementation; no raw Stitch color literals. |
| 100% visual match | **Unverified: 0/2 screens compared side by side in Light and Dark** | Stitch source screenshots were inspected, and dark-token rendering is tested. No running app screenshot pairs were captured. This does not meet `stitch-design.md` §0 visual acceptance. The workspace-wide deviation ledger is outside this worktree's writable roots; this local table is the handoff. |
| Imported `@RTK.md` instruction | Could not load | Referenced file was absent in the worktree, ancestor directories and user Codex directory; searches found no RTK.md. Workspace AGENTS/rules and task-relevant skills were read. |

## Validation

- `pnpm typecheck`: exit 0.
- `pnpm lint`: exit 0, no errors or warnings.
- `pnpm test`: 134 passed suites, 1 skipped, 1 failed; 1573 passed tests, 39 skipped, 3 failed. The three failures are unchanged `distribute-wrapper.test.ts` process-liveness tests. Direct `ps -o lstart= -p $$` returns `operation not permitted` in this sandbox.
- `pnpm test --exclude src/shared/config/__tests__/distribute-wrapper.test.ts`: exit 0; 134 suites / 1550 tests passed, 1 suite / 39 tests skipped. This is a supplemental supported-environment result, not a full-unit-suite pass.
- `pnpm test:ui --runInBand`: exit 0; 196 suites / 2362 tests passed.
- Focused regression run: exit 0; 6 suites / 68 tests passed, including both contribution screen tests, English Dark, i18n source-key checks, Profile row/navigation changes and unchanged onboarding badge wrapping.
- Final focused contribution/PlaceCard run: exit 0; 3 suites / 77 tests passed after the final shared photo-attribution change.
- `git diff --check`: exit 0.

No API contract, dependency or native changes. Existing save telemetry stays in the shared save mutation; route tagging stays in the application navigator. Rollback is the uncommitted diff in this worktree. Visual acceptance and the unrestricted full unit suite remain outstanding.


## Changed files

- `src/features/contributions/my-contributions.view.tsx:38`: place cards and real save/supplement actions; `:78`: review cards; `:110`: segments, counts, filters, async states and navigation.
- `src/features/contributions/my-contributions.style.tsx:3`: semantic Light/Dark layout.
- `src/shared/ui/place-card.view.tsx:234`, `src/shared/ui/place-card.style.tsx:6`: shared contribution variant and provider photo credits.
- `src/shared/ui/badge.view.tsx:26`, `src/shared/ui/badge.style.tsx:9`: token-backed solid status appearance.
- `src/shared/ui/text.tsx:35`: semantic canvas text color for inverse selected chips in either theme.
- `src/features/tabs/profile-settings-rows.ts:3`: one contributions row; `src/features/tabs/profile.view.tsx:71`: review shortcut destination.
- `src/shared/i18n/vi.ts:114`, `src/shared/i18n/en.ts:122`: Stitch copy and unavailable reasons.
- `src/features/__tests__/my-contributions.spec.tsx:1`: actions, lists, filters, counts, pagination, attribution and async states.
- `src/features/__tests__/my-contributions-dark.spec.tsx:1`: English Dark colors, selection and empty state.
- `src/features/tabs/__tests__/profile-settings-rows.test.ts:11`, `src/features/__tests__/design-drift-surfaces.spec.tsx:124`, `src/features/__tests__/plans-keo-shortcut.spec.tsx:122`: merged Profile row/shortcut regression checks.
- `docs/verification/issue-533-source/places.html:1`, `docs/verification/issue-533-source/reviews.html:1`: verbatim Stitch HTML reference artifacts only; never imported by the app.
