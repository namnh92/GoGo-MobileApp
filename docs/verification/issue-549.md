# GoGo-MobileApp #549 verification

> Historical #549 record below. The #564 audit at the end supersedes its decision to impose Explore geometry on every surface.

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


## #564 — per-surface regression correction (2026-11-08)

Branch `bugfix/GOGO-564-placecard-regression`, starting head `f28f617` (after #558). UI only; no commit/push. Compared the 16 renderer files from the inventory above at **99209be**, **be89530 (#554)** and the starting head, then checked the working render. The comparison is saved in `/tmp/564-callsite-comparison.log`; the three source revisions are under `/tmp/564-source/`. #558 had already repaired the assistant's horizontal-card migration, so that repair is preserved.

**Evidence:** enumerated the project and its hidden instances with Stitch MCP, then downloaded/read actual HTML using `download_file` (not titles or screenshots alone). Raw HTML is under `/tmp/564-stitch/<screen-id>.html`. All screen IDs below belong to `17315762413421369447`. Numbers in the layout descriptions are HTML/Tailwind geometry, converted to RN points. No sample facts were imported. Existing verified data, below-threshold rating rules, photo lifecycle/author links, save separation, navigation and actions remain shared.

| Call site | 99209be → #554 / starting head | Regressed by #554? | Actual Stitch screen ID and HTML geometry/order | #564 result and fix location |
| --- | --- | --- | --- | --- |
| Explore / search list | 16:10 photo, name/price, address, separate ratings, tags → same major frame, but extra category photo pill and 44pt tags | Yes, details; vertical frame unchanged | `17848934368042884162`: `aspect-[16/10]`, `rounded-[20px]`; distance/status on photo; name/price → address → ratings → caption tags | `list`: preserve 16:10 frame, omit category overlay, informational caption pills; shared view/style (A/B below). Caller `search/search.view.tsx:235` unchanged. |
| Explore zero-results nearby recovery | 80×80 thumbnail + distance; inline verification → name → address → ratings → price → generic `compact` with 96×192 media, photo hours/category and 44pt tags | **Yes** | `3359936827271145812` (hidden, “Không tìm được địa điểm”): current HTML has a **two-column editorial 4:3 collection rail**, not nearby place rows. It does not establish exact parity for the 99209be recovery rows. | Follow the owner's explicit restore-before-#554 instruction: `nearby`, 80×80 media with distance only, verification in copy, original fact order, no category/tags/hours on the tiny photo. `search/search-empty.view.tsx:88`, A:155/B:6/C:16. Current-reference discrepancy retained below. |
| Saved (all cities) | 176pt photo + bottom dark facts, title/address, ratings, tags/price → generic 16:10 list, price beside title | Yes; 99209be itself predates current v2 HTML | `4d2cde042356488abac342bedf0ff955`: `aspect-[16/9]`, 16pt corners, dark status **top left**, title → plain address → rating/price → compact tags | `saved`: 16:9 photo/top status, price beside rating group; source marks retained for both sources. `tabs/saved.view.tsx:103`, A:155/B:6. |
| Saved City | Same old Saved card → generic list | **Yes** | `5cd4c60b8f2e4236bb8d8b577befd489` (also reconciled `9fd8f655fad54c66b298cf16f3003300`): `h-44` photo, 16pt corners, dark bottom status/category/distance; title/address → separate ratings → tags + price | `saved-city`: 176pt media, bottom dark pills, price in taxonomy footer. `tabs/saved.view.tsx:103`, A:155/B:6. |
| Home recommendations | Already shared discovery card → added category pill and taller tags | Yes, details | `1141223353674973688`: 16:10 photo, 20pt corners; name/price → address → ratings → caption tags | Shared `list` correction. Caller `home/home.view.tsx:296` unchanged; A:155/B:6. |
| Assistant place result | Small icon/text card → #554 generic horizontal image card; #558 restored vertical verified-photo card at starting head | Yes in #554; orientation already repaired by #558 | `12608826252113319448`: 16:10 media with dark address overlay, name/price → ratings → caption tags → details CTA | `assistant`: put shared address over actual photo; keep #558's `showPhoto`, verified facts and unavailable/CTA behavior. `assistant/result-card.view.tsx:77`, A:155/B:6. No photo remains text-only. |
| Plan stops | Photo hero with order/lock/status and name/address over scrim → ordinary list body; feature controls outside photo | **Yes** | `11355754713814355549`: `h-40` image; top time/category/lock controls, bottom name/address; ratings and cost/details below | `plan-stop`: 160pt hero, shared name/address over solid scrim, feature controls inside photo, shared ratings/tags below; existing stop time/cost/actions retained. `date-plan/date-plan.view.tsx:429`, A:155/B:6. |
| Plan editor | 64×64 thumbnail beside stop order/name/duration → full nested compact card stacked above order/duration | **Yes** | `16408752368138891559` (duplicate `4001537474397277869`): `w-16 h-16`, stop label/rating → name → duration; actions below | `plan-edit`: 64×64 media, leading stop label + shared compact ratings, title, trailing duration/lock; actions unchanged. `date-plan/plan-edit.view.tsx:159`, A:155/B:6/C:16. |
| Active date — current | 192pt photo with ongoing badge, name/address + directions → generic list; ongoing badge below body | **Yes** | `17266945854767066432`: `h-52` photo, ongoing badge top left, title/address and directions together below; separate ratings | `active`: 208pt photo, ongoing badge on photo, directions beside shared heading; existing schedule/cost/map below. `active-date/active-date.view.tsx:400`, A:155/B:6. |
| Active date — next | 80×80 thumbnail beside name and arrival/cost → oversized nested compact card, arrival outside text column | **Yes** | `17266945854767066432`: `w-20 h-20` next thumbnail beside compact name/address/price and duration | `next-stop`: 80×80 image, compact body, arrival/cost inside shared text column; no photo hours/category overlay. `active-date/active-date.view.tsx:443`, A:155/B:6/C:16. |
| Swipe deck | Photo above name/address, price, ratings, reasons → fixed 260pt hero, price moved alongside name | Yes, geometry and order | `6469358302419743750`: 4:5 deck viewport, media `h-[58%]`; name/address left, price right, separate ratings, compact editorial tags | `swipe`: media aspect `(4/5)/0.58` preserves source media proportions without a fixed card height; name/address left, price right, ratings then caption tags; existing scroll/gesture/stamps retained. `matching/swipe.view.tsx:422`, A:155/B:6. |
| Match result — couple | 16:10 photo with result badge, title/address, price, ratings → generic list; result badge below facts | **Yes** | `18391407100350810666`: 16:10 photo; photo ribbon; heading/address left and price right; ratings, tags | `match`: feature result badge back on photo; list facts/compact tags with separate source badges. `matching/match-result.view.tsx:244`, A:155/B:6. |
| Match result — group | Same renderer and regression | **Yes** | `17426023099781066287`: 12pt inset card/media; title → address → price → separate ratings | `match-group`: 12pt inset, price below address, feature result badge on photo; no audience/business logic changes. `matching/match-result.view.tsx:244`, A:155/B:6. |
| Shared result / date postcard | Single 240pt photo with overlaid winner name/address → generic 260pt photo + full list facts | **Yes**; neither older single-winner layout reproduces the current two-stop composition | `17030740879031513402`: dark postcard; portrait `aspect-[4/5]` media with 8pt corners; compact title **below** photo, not a full list of place facts | `shared-result`: portrait media + name/address on shared dark surface; omit list ratings/status/price/tags. Existing single-winner data and surrounding score/share controls retained; no fabricated second stop. `review/shared-result.view.tsx:127`, A:155/B:6. Full postcard composition is outside this card regression. |
| Contributions | 176pt media + moderation badge, name/address, moderation footer → generic 16:10 photo + unrelated list facts | **Yes** | `3b383c779a7b4e41925a8a209cce3cc7` (also `34b7f4b13564449ab6bf662b204c149f`): `h-44`, 24pt corners; moderation on media, name/address, metadata/footer | `contribution`: 176pt photo, 24pt corners; no list price/rating/hour/tag block. Existing contribution badge/actions/footer retained. Caller `contributions/my-contributions.view.tsx:66` unchanged; A:155/B:6. |
| Existing import result | Already discovery PlaceCard → same major frame; inherited category/large-tag change | Yes, details; no major frame regression | `11596318734062514103`: 16:10 media, title/address and independently sourced ratings; import actions below | Shared list correction; verified identity/actions remain unchanged. Caller `place-import/existing-place-result.view.tsx:39` unchanged; A:155/B:6. |
| Provider import preview — full | Already preview: 16:10 media, name/address/category, Google/hours in body → same layout, shared Google/address styles | **No structural regression** | `2fd3b7e365954d6db9ef612d361a1bbf`: 16:10 media, name/address, Google rating and schedule row; `f8006c44f1594868bcc510608fab6a50` provides multiple choices | Keep `preview` renderer and provider photo/candidate/credit lifecycle. Caller `place-import/import.view.tsx:441`; shared view A unchanged in preview branch; C normal badge path unchanged. |
| Provider import preview — compact | Already 48×48 optional photo + name/address/credit → same | **No structural regression** | `2726e17cbdb0499da0adb7cf74ae33c5`: matching success/error result sheet. Its current HTML does **not** draw the submitted 48×48 media slot; 48×48 is the unchanged pre-#554 implementation, not a claimed Stitch measurement | Preserve compact preview; no canonical GoGo identity/actions inferred. Caller `place-import/import.view.tsx:540`, A preview branch unchanged. |
| Review place subject address | Plain caption address → shared address adds pin and larger type | **Yes** | `2173455576639071118`: title + plain caption address beneath, no address pin | Shared address `compact pin={false}` restores caption/no-pin layout. `review/my-reviews.view.tsx:65`, A. Individual review score and review media stay review-owned. |
| Detail rating row | Independent source badges → #554 standardizes to list badge geometry | Yes, geometry | `1593725092880141532`: separate badges, 12×6 padding, 8pt corners, bordered white Google badge and secondary GoGo badge | `RatingChips detail`: shared rating logic/source order with detail geometry; role-based surfaces/border. `date-plan/place-detail.view.tsx:498`, C. |

Fix-location key (paths relative to repository root):

- **A:** `src/shared/ui/place-card.view.tsx:107` (shared address), `:119` (tags), `:132` (photo/status facts), `:155` (variant composition) — variant selection and shared composition; address, tags, availability and photo subcomponents stay shared.
- **B:** `src/shared/ui/place-card.style.tsx:6` (row/media geometry), `:29` (Saved body/footer), `:66` (photo pills) — media sizes, row/overlay positioning, caption-pill geometry and role-token surfaces.
- **C:** `src/shared/ui/rating-chips.view.tsx:16` / `src/shared/ui/rating-chips.style.tsx:6` — shared compact/detail geometry, unchanged independent sources/count threshold.

### Availability, themes and proof boundary

Status text no longer has `numberOfLines` or `ellipsizeMode`; the badge does not shrink below its text, can wrap as a bounded row, and the label can wrap inside the card. A nearby thumbnail renders **distance only**, as before #554, rather than squeezing the full opening sentence into it. Tests use `Mở đến 23:59` at a 288pt card width. Caption tags are informational shared pills; they do not inherit the 44pt minimum intended for interactive Chip controls.

No new colour literals or per-screen palette were introduced. Restored surfaces use role-named shared tokens (`redesign.card/container/ink/secondary`, `accent.*`, `night.raised`, `overlay.scrimText`, shared border/status roles). The redesigned role values already present in `tokens.ts` are reused; old pre-redesign values do not replace them. Dark renders use the same roles and structure. Existing fixed source-brand badges keep the shared secondary roles.

**Reference discrepancies are explicit:** the current hidden empty-state HTML contains editorial collections, while 99209be implemented nearby places; the owner specifically requested that prior recovery layout. The current share postcard has two plan-stop portraits while this renderer only has one ranked winner. This change uses its portrait/name arrangement for the available entity; it does not add an unverified stop or change data fetching. The submitted compact provider preview is likewise unchanged: the current result-sheet HTML (`2726e17cbdb0499da0adb7cf74ae33c5`) does not draw that optional media slot, so it cannot establish its exact 48×48 parity. These are not claims of full-screen Stitch pixel parity. No simulator screenshots or Yoga text measurements were captured.

### #564 verification

| Gate | Result | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/564-typecheck.log` |
| `pnpm lint` | PASS, exit 0; no warnings | `/tmp/564-lint.log` |
| `pnpm test` | Exit 1: 1683 passed, 39 skipped, exactly the three supplied sandbox lock failures; 139 files passed / 1 skipped / 1 failed | `/tmp/564-test.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 209 suites / 2849 tests | `/tmp/564-test-ui.log` |
| Final affected UI rerun | PASS, exit 0: 5 suites / 187 tests, including two extra missing-address cases and preview geometry assertions added after the full run | `/tmp/564-focused.log` |
| `git diff --check` | PASS | `/tmp/564-diff-check.log` |

The last focused rerun covers the final missing-address guard and shared photo fallback role adjustment, alongside assistant and provider-preview consumers. Typecheck/lint were rerun after those final changes. No test timeout or sandbox exception was added.

Vitest failures remain confined to unchanged `src/shared/config/__tests__/distribute-wrapper.test.ts`: `refuses while the owner is alive`, `refuses recovery while a recorded build process group is still alive`, and `keeps the lock and run files when a recorded build group is still alive after the child exits`. The place-card ownership and all 17 call-site selection checks passed in the full Vitest run.

Regression proof: the two focused legacy tests were run against the original starting-head shared card files and **both failed** (96×192 thumbnail; `numberOfLines=1` on closing time), `/tmp/564-before.log`. The patched card passed them. All original source files were restored immediately after the comparison. `/tmp/564-focused.log` records the patched shared card/rating/layout checks. Structural assertions cover every canonical layout in Light/Dark, body/media order, feature controls remaining in their slots, compact content omissions, separate rating source order, and per-feature variant selection. This is structure/token evidence, not measured device text fit.


### #564 — thống nhất overlay giờ mở cửa (owner 2026-11-08)

Quyết định owner sau khi so Saved và Home trên simulator Dark: mọi pill giờ mở cửa trên ảnh dùng cùng quy ước Explore/Home — **dưới trái**, nền tối trong suốt, chấm và chữ mang màu trạng thái (mở/đóng). Góc trên trái dành riêng cho badge GoGo xác thực; bookmark giữ góc trên phải. Dòng địa chỉ hiện có luôn có pin, bao gồm Saved, Saved City, Nearby và Contributions. Không thêm địa chỉ vào plan editor vốn không có dòng địa chỉ.

Quyết định này **ghi đè Stitch Saved `4d2cde042356488abac342bedf0ff955` và Saved City `5cd4c60b8f2e4236bb8d8b577befd489`** (owner 2026-11-08). Saved bỏ status trên trái; Saved City dùng cùng nền/màu/khoảng cách/đặt status trước distance và category. Các hàng pill wrap ngược để status luôn ở hàng dưới cùng bên trái khi nhãn dài. Các mô tả parity Saved/Saved City và quy tắc không-pin ở bảng #564 phía trên là bằng chứng lịch sử, được quyết định này thay thế.

Sửa tại shared renderer/style; không thêm palette theo màn. Nhãn như `Mở đến 23:59` và `Đã đóng · Mở 08:00 ngày mai` vẫn suy ra từ dữ liệu giờ hoạt động và i18n. Màu chữ/chấm trên nền ảnh tối tái sử dụng shared `onDark.success/danger` (alias của `darkStatus.successText/dangerText`) ở cả Light/Dark. Tiêu đề/địa chỉ overlay xếp phía trên hàng status để không đè nhau; badge tính năng nằm dưới vùng xác thực. Các biến thể trước đó không có giờ trên ảnh (thumbnail nhỏ, assistant, hero/plan, contribution, postcard) giữ bộ thông tin hiện có; không ép câu giờ mở cửa vào thumbnail 64/80pt. Preview provider tiếp tục dùng bộ thông tin riêng, không suy diễn xác thực GoGo.

Kiểm thử Light + Dark kiểm tra riêng các variant có status (`list`, `saved`, `saved-city`, `active`, `swipe`, `match`, `match-group`): status đầu hàng pill ở footer dưới trái, badge xác thực trên trái, pin trong dòng địa chỉ, nền scrim và màu chấm/chữ. Ba variant list/Saved/Saved City có thêm ca đóng và mở lại ngày mai. Ma trận geometry kiểm tra pin ở mọi dòng địa chỉ hiện có; giữ các omission của thumbnail/lean. Đây là bằng chứng cấu trúc/token; chưa có screenshot simulator hay đo text-fit trên thiết bị cho lần sửa này.


| Gate bản cuối | Kết quả | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/564b-typecheck.log` |
| `pnpm lint` | PASS, exit 0, không warning | `/tmp/564b-lint.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 209 suites / 2871 tests | `/tmp/564b-test-ui.log` |
| `git diff --check` | PASS, exit 0 | `/tmp/564b-diff-check.log` |

Không commit/push. Kiểm tra cấu trúc Light/Dark không thay thế xác nhận simulator của owner.

### #564 — đúng hai common component (owner 2026-11-08, thay thế ma trận variant phía trên)

Quyết định cuối của **owner 2026-11-08** thay thế yêu cầu “một variant” ban đầu và toàn bộ lựa chọn `list/hero/nearby/saved/saved-city/contribution/assistant/plan-stop/plan-edit/active/next-stop/swipe/match/match-group/shared-result/preview` trong bảng lịch sử. App chỉ còn hai composition công khai: `PlaceCardLarge` và `PlaceCardSmall`, mỗi component có file view/style riêng trong `src/shared/ui`. `place-card.view.tsx` chỉ chứa shared parts và data adapter, không còn renderer thứ ba hay selector layout. Feature import trực tiếp một trong hai component.

Đã mở **dưới dạng ảnh** hai reference owner: `dev/handoffs/card-refs/card-large-explore.png` và `card-small-zero-results.png`.

- **LARGE** theo Explore/Home: ảnh 16:10, verified trên trái khi có dữ liệu, bookmark trên phải, status dưới trái với nền tối trong suốt; body gồm tên + giá có đơn vị, địa chỉ có pin tối đa hai dòng, Google + GoGo cùng hàng (wrap khi cần), category + purpose/vibe tags. Giữ nguyên sửa status-pill chưa commit có sẵn trong worktree.
- **SMALL** theo ELSOL/Haidilao: khung bo góc có viền, padding 8pt, thumbnail vuông 80pt bên trái, tên và địa chỉ một dòng ellipsis bên phải, Google và GoGo xếp dọc như ảnh mẫu. Dùng chung image/placeholder; địa chỉ Small không có pin để giữ đúng reference. Các dữ liệu bổ sung vẫn hiện khi có: verified, status/next-open, distance, giá + đơn vị, category/tags, attribution; bookmark hoặc header action là tùy chọn.
- Hai composition dùng chung image/placeholder, address, verified, status/distance, price, rating pills, tag pills, credits và save control. Surface/text/border/accent/status dùng role token hiện có cho Light/Dark; không thêm palette theo feature.
- Không bỏ logic conditional: verified chỉ từ `discovery.verified`; giờ đóng/mở lại suy ra từ API/hours; Google và GoGo độc lập, có count; GoGo dưới threshold hiển thị wording + count; giá thiếu dữ liệu bị ẩn; category và tags được gộp/deduplicate; distance chỉ khi được cung cấp; photo attribution và link tác giả được giữ. Provider preview giữ fetch/abort/no-cache/error lifecycle, lịch ngày/qua đêm và credits; không suy diễn canonical ID, GoGo verification hay quyền lưu.

**Stitch deviations — owner 2026-11-08:** Saved `4d2cde042356488abac342bedf0ff955` và Saved City `5cd4c60b8f2e4236bb8d8b577befd489` không còn là nguồn cho layout riêng. Cả hai dùng cùng LARGE với Home/Explore: bỏ category chip trên ảnh, đưa category vào tags; địa chỉ có pin; bỏ divider trước tags; cùng geometry và vị trí price/rating/status. Mọi mô tả parity/omission của các variant cũ ở phần trước là lịch sử, không phải hành vi hiện tại. Các thẻ plan/match/contribution/postcard/provider cũng chuyển sang hai common component theo quyết định app-wide này.

#### Toàn bộ call site → LARGE / SMALL

Đường dẫn dưới đây tính từ `src/features/`.

| Call site | Common component | Vị trí |
| --- | --- | --- |
| Home | LARGE | `home/home.view.tsx:296` |
| Explore list / map fallback list | LARGE | `search/search.view.tsx:235` |
| Saved | LARGE | `tabs/saved.view.tsx:99` |
| Saved City | LARGE, cùng JSX với Saved | `tabs/saved.view.tsx:99` |
| Existing map marker preview | SMALL; thay layout tên + nút tự dựng | `search/search.view.tsx:250` |
| Explore zero-results nearby suggestions | SMALL | `search/search-empty.view.tsx:88` |
| Existing add-place result popup | SMALL | `place-import/existing-place-result.view.tsx:39` |
| Add-place branch selection (thay name/address layout tự dựng) | SMALL | `place-import/import.view.tsx:420` |
| Extracted provider preview | LARGE, provider data adapter | `place-import/import.view.tsx:437` |
| “Đã gửi cho GoGo duyệt” result sheet | SMALL, provider data adapter | `place-import/import.view.tsx:535` |
| Assistant place result | LARGE | `assistant/result-card.view.tsx:77` |
| Date-plan stops | LARGE | `date-plan/date-plan.view.tsx:429` |
| Plan editor stop rows | SMALL | `date-plan/plan-edit.view.tsx:159` |
| Active-date current stop | LARGE | `active-date/active-date.view.tsx:401` |
| Active-date next stop | SMALL | `active-date/active-date.view.tsx:444` |
| Matching swipe candidate | LARGE | `matching/swipe.view.tsx:422` |
| Match result, couple/group | LARGE | `matching/match-result.view.tsx:244` |
| Match runners-up | SMALL; giữ rank, điểm và host/member action | `matching/match-result.view.tsx:292` |
| Shared-result winner | LARGE | `review/shared-result.view.tsx:127` |
| Review place subject | SMALL | `review/my-reviews.view.tsx:52` |
| My contributions | LARGE | `contributions/my-contributions.view.tsx:66` |
| Map marker tap #561 (nhánh khác) | **SMALL export sẵn để adopt** | `src/shared/ui/place-card-small.view.tsx:8`; chưa sửa/kiểm tra nhánh #561 |

Place detail là trang entity, review media là entity review, `AssistantPlaceCard` trên detail là CTA mở trợ lý; chúng không phải place-card list. Review place subject cũng dùng SMALL; features không import shared card parts. Enforcement chỉ giữ ngoại lệ media có tên cho trang detail/review, không cấp ngoại lệ layout place-card.

#### Bằng chứng cấu trúc và giới hạn

`place-card-layout.spec.tsx` pin hai cấu trúc LARGE/SMALL qua snapshot **testID/thứ tự/line-limit, không snapshot màu**, chạy full-data và minimal-data trong Light + Dark. Các ca bổ sung kiểm tra field đủ dữ liệu, below-threshold GoGo count, closed/next-open, pin Large, category trong tags, media geometry Small, status overlay Large ở 288pt và save độc lập với open.

`place-card-enforcement.spec.ts` chạy trong `test:ui`: kiểm tra AST toàn bộ call site, cấm layout selector cũ và import composition khác trong features; cấm inline address/rating/status/image renderers; pin Home/Explore/Saved/Saved City cùng component và interaction-prop structure. Test provider tiếp tục kiểm tra bytes/credits/no-cache, lỗi ảnh, token/branch selection và result-sheet identity. Các assertion layout preview cũ đã chuyển sang common Large/Small theo owner.

Đây là bằng chứng cấu trúc và role token, **chưa phải pixel-parity/text-fit đã đo trên simulator**. Hai ảnh reference đã được xem; không ghi nhận screenshot mới hay xác nhận runtime cho nhánh map #561. Không commit/push.

#### Gate cuối — worktree chưa commit trên `8ee0976`

| Gate | Kết quả | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/564c-typecheck.log` |
| `pnpm lint` | PASS, exit 0, không warning | `/tmp/564c-lint.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: **210 suites / 2844 tests / 9 structure snapshots** | `/tmp/564c-test-ui.log` |
| `git diff --check` | PASS, exit 0 | `/tmp/564c-diff-check.log` |

Lần chạy full cuối bao gồm review subject, map preview và runners-up đã chuyển sang SMALL; không phải kết quả của phiên bản trung gian. Các log `564c-focused`, `564c-import`, `564c-review-subject`, `564c-map-ranking` và `564c-enforcement` lưu các lần kiểm tra trong quá trình sửa; kết quả gate cuối dùng bảng trên. Không commit/push, không sửa nhánh #561.
