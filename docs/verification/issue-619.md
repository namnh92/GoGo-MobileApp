> Cập nhật round 6h (2026-11-12): màn Quản lý phòng đã bỏ; các ghi nhận
> manage bên dưới là bằng chứng lịch sử. Chức năng hiện tại nằm ở sảnh phòng;
> `/room/[roomId]/manage` chỉ redirect về sảnh. Xem
> [quyết định hiện hành](../redesign/issue-595-unified-room-edit.md#round-6h--quyết-định-owner-2026-11-12-10-thay-màn-quản-lý-phòng).

# GoGo-MobileApp #619 — first-page list skeletons

Scope: re-design UI only. No git commands, API/query/pagination changes, dependency changes, commits or simulator actions.

## Screen audit

| Screen | Result |
| --- | --- |
| Notifications, signed-in system feed | Replaced first-load logo with shared notification row skeletons; personal notifications use the same component. |
| Public/system notifications section | Replaced the single rectangle with matching icon, heading, body and action rows. |
| Plans, upcoming/history tabs | Replaced member rows with plan cards containing icon, status chip, title and facts. |
| My reviews | Replaced member rows with review cards containing subject, rating/date, body and status/action. |
| Room management | Replaced first-load logo with heading/constraint blocks and member rows. |
| Plan editor | Replaced first-load logo with compact place-card skeletons with reorder/remove action placeholders. |
| Profile upcoming room | Replaced first-page loading text with an icon/text row skeleton. |
| Home, Explore/Search list/map fallback, Saved and Saved City | Already use shared place-card skeletons; fixed the shared photo geometry to preserve the large card's 16:10 ratio instead of defaulting to 12px height. |
| My contributions, places/reviews | Already use shared contribution card skeletons; added first-page render coverage for both tabs. |
| GoGo AI history | Already uses card row skeletons; added first-page render coverage. |
| Room lobby/members | Already uses member skeletons; strengthened first-page render coverage. |
| Place reviews | Already uses rating/body row skeletons; added first-page render coverage. |
| AI conversation, plan/detail/change/active-date stop lists, matching candidates | Existing bubble, timeline, detail and candidate skeletons retained. |
| Credit history | No route or screen exists in this source tree. Credit balance/reward labels are not a history list. |

Searched all `LoadingIndicator`, `LoadingState`, `ActivityIndicator`, `loading-list`, pending/loading branches and list usages. Pagination footer, pull-to-refresh, button busy and submit overlay indicators remain. Non-list account/settings/forms, link resolution, permission requests and contribution detail hydration over an already-rendered card remain outside this first-page list fix.

## Shared behavior and regression coverage

- Skeleton blocks use `theme.surface.subtle`; new card containers use shared semantic surface tokens.
- Motion remains static while the OS preference is unknown or reduced; normal pulse uses non-interaction animations and stops on unmount.
- Theme token tests evaluate Light/Dark styles separately because the Unistyles Jest adapter resolves styles at import time.
- Initial-load render matrix covers Plans, Saved, Saved City, both contribution tabs, My reviews, room management, plan editor, profile upcoming, AI history and public notifications in Light/Dark. Additional tests cover signed-in notifications, Home/Search, room lobby and place reviews.
- Existing refresh and load-more tests preserve the branded mark after page one.
- Updated legacy feedback mocks to preserve actual exports when the skeleton reads the tri-state motion hook.

Baseline evidence: the signed-in system feed explicitly rendered `LoadingIndicator` for `isPending || loadingAll`; room management and plan editor rendered `LoadingState` while pending. Plan/My reviews used `RoomMemberSkeleton` despite different loaded cards. This source audit is the before-fix evidence; no git checkout or baseline reset was used.

## Validation

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm test:ui --runInBand`: PASS — 238 suites, 3514 tests, 11 snapshots.
- Owner simulator acceptance: NOT RUN, reserved for owner per issue AC.
