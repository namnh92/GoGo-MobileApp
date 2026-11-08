# GoGo-MobileApp #549 verification

Scope: UI only on `feature/GOGO-549-placecard-unify`, continuing the supplied uncommitted patch from `re-design`. No commits or pushes. Button and sheet components are unchanged.

## Stitch evidence and conflict resolution

Read through Stitch MCP on 2026-11-08 in project `17315762413421369447`; downloaded the HTML of all four references below, and inspected the Explore screenshot. `gh issue view` could not reach GitHub in this sandbox; the GitHub connector read issue #549 successfully.

| Reference | Screen ID | HTML file ID | Observed conflict and chosen resolution |
| --- | --- | --- | --- |
| Khám phá / search list, titled “Tìm địa điểm - GoGo” | `17848934368042884162` | `3054129010096043786` | Canonical: 16:10 image, 20pt card corners, light photo pills, pin address, gray Google badge with visible Google/count, separate violet GoGo badge, wrapping tags. |
| Đã lưu - GoGo | `6045502163558025217` | `7139670540051623733` | Top status/category plus a dark combined hours/distance pill; different card radius and rating star styling. Use the list card's shared light pill and fact styles. Category remains optional verified taxonomy data. |
| Đã lưu v2 - GoGo | `4d2cde042356488abac342bedf0ff955` | `141749d3e6b74d3aaaa9328ccc4022f3` | Dark top-left status, 16:9 image, address without pin, inline amber Google rating/price, outlined rounded-rectangle tags. Replace with the list geometry/fact styling and shared #544 Chip. |
| Chi tiết địa điểm v4 · Light | `1593725092880141532` | `1593725092880141574` | White bordered Google badge with larger padding; different community badge. Detail now uses the same gray/violet rating badges as the list. |

Owner instruction in this task resolves disagreements in favor of the Explore list. Data-free fields are omitted per core.md 15. No sample places, prices, scores, tags or counts were copied from Stitch. Google and GoGo remain separate; the existing `ratingParts` threshold is reused. Counts below threshold render `GoGo · Chưa đủ đánh giá (n)`; absent community data renders nothing. Provider photo credits and author links remain available in every context.

The shared tag row renders all distinct supplied tags through #544's `Chip` with its soft appearance; it does not impose a different per-screen tag cap. The provider preview keeps its import-specific identity/actions and candidate photo lifecycle, while delegating address and Google rating styling to the same shared components. Review thumbnails and detail gallery media remain owned by their respective entities.

## Call-site inventory

“Already shared” sites were audited and inherit the unified implementation without a feature-file edit. Plan-only assistant results retain their plan card; `AssistantPlaceCard` in detail is the AI question entry, not a place-facts card.

| Surface | Renderer location |
| --- | --- |
| Explore / search list (already shared) | `src/features/search/search.view.tsx:233` |
| Search nearby recovery | `src/features/search/search-empty.view.tsx:88` |
| Saved and saved city (same renderer) | `src/features/tabs/saved.view.tsx:99` |
| Home rail (already shared) | `src/features/home/home.view.tsx:296` |
| Assistant place result | `src/features/assistant/result-card.view.tsx:57` |
| Plan stops | `src/features/date-plan/date-plan.view.tsx:430` |
| Plan editor | `src/features/date-plan/plan-edit.view.tsx:159` |
| Active date current / next | `src/features/active-date/active-date.view.tsx:400, 445` |
| Swipe deck | `src/features/matching/swipe.view.tsx:422` |
| Match result | `src/features/matching/match-result.view.tsx:243` |
| Shared result | `src/features/review/shared-result.view.tsx:127` |
| Contributions (already shared) | `src/features/contributions/my-contributions.view.tsx:66` |
| Existing import result (already shared) | `src/features/place-import/existing-place-result.view.tsx:39` |
| Provider import preview (already shared) | `src/features/place-import/import.view.tsx:441, 540` |
| Review place subject address | `src/features/review/my-reviews.view.tsx:65` |
| Detail rating row | `src/features/date-plan/place-detail.view.tsx:498` |

## Enforcement and verification

`src/shared/ui/__tests__/place-card-enforcement.test.ts` scans all feature TSX outside test directories. It rejects local place-photo imports (with explicit gallery/review-thumbnail ownership exceptions), local address rows, known rating/status translations, inline rendered rating/address facts, and local fact decorations. Negative fixtures prove these detectors reject duplicates independently of the production scan. Individual review scores remain review data, not a place aggregate.

Shared UI tests cover canonical styles across contexts, layout variants, independent ratings/counts, below-threshold scores, missing facts, locale formatting, real address composition/cache behavior, provider credits, independent save actions, bounded photo pills, and Light/Dark semantic surfaces with finite badge geometry. The half-indexed spacing lookup from the interrupted patch was fixed; it previously yielded a non-finite badge radius.

Fresh final gates (2026-11-08; old/truncated logs were overwritten):

| Gate | Result | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/549-typecheck.log` |
| `pnpm lint` | PASS, exit 0, no warnings | `/tmp/549-lint.log` |
| `pnpm test:ui --runInBand` | PASS, 202 suites / 2601 tests, exit 0 | `/tmp/549-test-ui.log` |
| `pnpm test` | Exit 1: 1662 passed, 39 skipped, 3 known sandbox lock failures; 138 files passed / 1 skipped / 1 failed | `/tmp/549-test.log` |

The focused card/enforcement checks also passed. `git diff --check` passed. The complete UI rerun includes migration consumers, review aggregate refresh, photo fallbacks, Saved, Home, assistant, and contributions; no timeout exceptions were added.

Visual limit: no app-versus-Stitch simulator screenshots were captured in this run. Light/Dark token and structural tests do not establish pixel parity or device text-fit acceptance.

The final Vitest failures are confined to `src/shared/config/__tests__/distribute-wrapper.test.ts`: `refuses while the owner is alive`, `refuses recovery while a recorded build process group is still alive`, and `keeps the lock and run files when a recorded build group is still alive after the child exits`. These are the supplied process-inspection sandbox baseline; the wrapper and its tests were not changed. An earlier fresh run also reproduced the fourth intermittent owner-file lock failure; the final run reproduced three. The enforcement suite passed within the full final Vitest run.
