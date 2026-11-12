> Cập nhật round 6h (2026-11-12): màn Quản lý phòng đã bỏ; các ghi nhận
> manage bên dưới là bằng chứng lịch sử. Chức năng hiện tại nằm ở sảnh phòng;
> `/room/[roomId]/manage` chỉ redirect về sảnh. Xem
> [quyết định hiện hành](../redesign/issue-595-unified-room-edit.md#round-6h--quyết-định-owner-2026-11-12-10-thay-màn-quản-lý-phòng).

# GOGO-535 — một header dùng chung

Ngày 2026-11-08. Worktree `mobile-535`, nhánh `feature/GOGO-535-shared-header`, nền PR #534 tại `ea0deb6`. Không commit/push.

## Quyết định từ inventory

Đã grep toàn bộ `src/features` theo header/back/title/bell, kiểm tra route re-export trong `src/app`, và dùng Stitch MCP `list_screens` + `download_file` cho project `17315762413421369447`: 90 tài nguyên, 86 có HTML, tải thành công 86/86; 73 HTML có thẻ `<header>`. Bốn tài nguyên còn lại chỉ là ảnh. Snapshot giữ source screen ID, file ID, markup header, heading đầu và ngữ cảnh heading khi HTML không dùng thẻ header tại [issue-535-stitch-headers.json](issue-535-stitch-headers.json). Đây là inventory phục vụ header, không phải chứng nhận migration toàn project.

Ba variant dùng chung:

- `tab-root`: wordmark i18n `splash.brand`, tên màn i18n, bell; hàng tối thiểu 64pt. Nguồn Stitch Home `1141223353674973688`, Plans `15334143905524313049`, Profile `9700245316043548900`, Saved `6045502163558025217`.
- `sub-screen`: back 44pt, tên màn, bell; hàng tối thiểu 56pt, title luôn căn trái theo quyết định owner 2026-11-08; không còn prop/layout căn giữa. Nguồn nhập link `a3500cc50aef4fbab76bf4587a8f6b20`, đóng góp `d9a8855514e94eb395b5b37e99a09129` / `303754ee1bc84f31b5405ad394c7ea81`, place detail `1593725092880141532`, saved city `5cd4c60b8f2e4236bb8d8b577befd489`.
- `sheet`: cùng bố cục title trái và local Back/Close/action như sub-screen, không render bell/unread dot. Dùng cho selector hành chính (cả standalone Sheet và embedded trong area sheet) và mọi AssistantHeader (welcome, conversation, history, sign-in prompt); tránh push `/notifications` vào/đằng sau native modal.

Không tạo variant large-title: Plans trong Stitch dùng header compact 64pt có wordmark, không dùng display title. Display heading cũ trong Plans được thay bằng tab-root.

`rightAction` nhận một hoặc nhiều action cạnh bell; `AppHeaderAction` áp cùng target, trạng thái disabled/pressed và nhãn a11y. #537 có thể truyền action “Lưu” mà không tự dựng bar. `titleAccessory` giữ khu vực, số địa điểm; `leading` giữ avatar/Close của AI. `subtitleTone` giữ trạng thái offline. Modal AI và selector hành chính dùng `safeArea={false}` vì container đã xử lý inset; màn ứng dụng để header sở hữu top/left/right safe-area.

## Owner exception — 2026-11-08

Owner tại [GoGo-MobileApp#535, comment 6715286143](https://github.com/namnh92/GoGo-MobileApp/issues/535#issuecomment-6715286143) yêu cầu **title header luôn căn trái trên mọi variant và màn**. Đây là ngoại lệ có ngày đối với Stitch: tất cả source dùng title giữa phải render title trái trong app; không tạo API opt-in căn giữa. Snapshot Stitch giữ nguyên để đối chiếu. Các source centered-title đã ghi nhận trong inventory:

| Source Stitch | Screen ID |
| --- | --- |
| Thêm địa điểm: Nhập link | `a3500cc50aef4fbab76bf4587a8f6b20` |
| Đóng góp của tôi | `d9a8855514e94eb395b5b37e99a09129`, `303754ee1bc84f31b5405ad394c7ea81`, `9dcc2716e2d04f53a869b059a2738268` |
| Đóng góp của tôi v2 | `34b7f4b13564449ab6bf662b204c149f`, `3b383c779a7b4e41925a8a209cce3cc7` |
| Đóng góp của tôi v2 · Đánh giá | `bef0f4bd44ba45d6aeef17000649f26a` |
| Đóng góp của tôi · Card | `12774f9e0fe143aa8d0a5cb160f4ee7e` |

Nguồn có `text-center`, title ở giữa Back/action hoặc placeholder cân hai bên đều thuộc ngoại lệ này. Owner rule áp dụng cả các source centered-title khác nếu bổ sung sau.

## Deep link cho screenshot (GoGo Dev)

- Home tab: route `/(tabs)` (`src/app/(tabs)/index.tsx`), URL **`gogo-dev://(tabs)`**.
- Search: route `/places/search` (`src/app/places/search.tsx`), URL **`gogo-dev://places/search`**.

`/home` và `/search` không phải route nên `gogo-dev://home` / `gogo-dev://search` vào not-found. `/` là splash quyết định onboarding/Home, không phải route Home tab trực tiếp. `+native-intent` chỉ rewrite room invite, giữ nguyên hai đường dẫn trên. Xác minh từ route/config trong source và `extractExpoPathFromURL` của Expo Router (lần lượt trả `(tabs)` / `places/search`); chưa chạy deep link trên simulator trong task này.

## Màn đã migrate

34 feature screen có route (35 route entries vì permissions có hai alias), cộng lịch sử AI nội bộ. Tất cả loading/empty/error/offline branches có nav bar đều dùng cùng header. Các screen qua wrapper được liệt kê riêng để không bỏ sót default-profile success branch.

| Màn | File:line | Header |
| --- | --- | --- |
| Trang chủ | `src/features/home/home.view.tsx:157` | tab-root |
| Kế hoạch | `src/features/tabs/plans.view.tsx:124` | tab-root |
| Đã lưu | `src/features/tabs/saved.view.tsx:117` | tab-root |
| Cá nhân | `src/features/tabs/profile.view.tsx:105` | tab-root |
| Đã lưu / thành phố | `src/features/tabs/saved-city.view.tsx:34` | sub-screen, trái |
| Tìm địa điểm | `src/features/search/search.view.tsx:261` | sub-screen, trái + khu vực |
| Thêm địa điểm | `src/features/place-import/import.view.tsx:279` | sub-screen, luôn trái |
| Chi tiết địa điểm | `src/features/date-plan/place-detail.view.tsx:90` | sub-screen, trái + báo sai/lưu |
| Đóng góp của tôi | `src/features/contributions/my-contributions.view.tsx:159` | sub-screen, trái |
| Tài khoản | `src/features/account/account.view.tsx:87` | sub-screen, trái |
| Thông báo | `src/features/notifications/notifications.view.tsx:128` | sub-screen, trái |
| Đăng nhập / đăng ký | `src/features/auth/sign-in.view.tsx:190` | sub-screen, trái |
| Phòng hẹn | `src/features/gogo-room/gogo-room.view.tsx:370` | sub-screen, trái |
| Lời mời tham gia | `src/features/gogo-room/guest-join.view.tsx:151` | sub-screen, trái |
| Vào phòng bằng mã | `src/features/gogo-room/join-by-code.view.tsx:94` | sub-screen, trái |
| Quản lý phòng | `src/features/gogo-room/room-manage.view.tsx:55` | sub-screen, trái |
| Chọn sở thích | `src/features/matching/preference.view.tsx:130` | sub-screen, trái |
| Chọn theo ý bạn | `src/features/matching/swipe.view.tsx:267` | sub-screen, trái + bộ đếm |
| Lịch trình | `src/features/date-plan/date-plan.view.tsx:188` | sub-screen, trái |
| Đổi kế hoạch | `src/features/date-plan/plan-change.view.tsx:45` | sub-screen, trái |
| Sửa lộ trình | `src/features/date-plan/plan-edit.view.tsx:67` | sub-screen, trái |
| Đang đi chơi | `src/features/active-date/active-date.view.tsx:246` | sub-screen, trái |
| Đánh giá | `src/features/review/review.view.tsx:217` | sub-screen, trái |
| Đánh giá của tôi | `src/features/review/my-reviews.view.tsx:124` | sub-screen, trái |
| Màu chủ đề | `src/features/account/theme-screen.view.tsx:7` | SettingsPage |
| Mặc định tạo kèo | `src/features/account/defaults-screen.view.tsx:18` | SettingsPage / ProfileDefaultsCard |
| Quyền và dữ liệu (cả /settings/location và /settings/notifications) | `src/features/settings/permissions.view.tsx:41` | SettingsPage |
| Tạo kèo / đối tượng | `src/features/create-date/create-type.view.tsx:73` | WizardStep |
| Tạo kèo / nhóm | `src/features/create-date/group-setup.view.tsx:40` | WizardStep |
| Tạo kèo / khu vực | `src/features/create-date/create-location.view.tsx:122` | WizardStep |
| Tạo kèo / thời gian | `src/features/create-date/create-time.view.tsx:109` | WizardStep |
| Tạo kèo / ngân sách | `src/features/create-date/create-budget.view.tsx:62` | WizardStep |
| Tạo kèo / mood | `src/features/create-date/create-mood.view.tsx:153` | WizardStep |
| GoGo AI / chào mừng và trò chuyện | `src/features/assistant/assistant.view.tsx:105` | AssistantHeader |
| GoGo AI / lịch sử (view nội bộ) | `src/features/assistant/history.view.tsx:217` | AssistantHeader |

Các host/wrapper và selector:

- `src/shared/ui/app-header.view.tsx:34`
- `src/shared/ui/app-header.style.tsx:5`
- `src/shared/ui/header-notification-button.view.tsx:10`
- `src/features/settings/settings-page.view.tsx:24`
- `src/features/account/profile-defaults.view.tsx:199`
- `src/features/create-date/wizard-step.view.tsx:40`
- `src/features/assistant/assistant-header.view.tsx:40`
- `src/shared/administrative/administrative-picker.view.tsx:49`

Đã xoá `BackHeader` và toàn bộ style nav bar cũ trong `primitives`; xoá stylesheet riêng của AssistantHeader; bỏ style nav/back/title/bell ở Home, Plans, Profile, Saved, SavedCity, Search, Import, PlaceDetail, SettingsPage. Các `header` còn ở card/sheet là heading nội dung, không phải navigation bar. Tên `headerText`/`topBar` dùng cho nội dung được đổi để rõ nghĩa.

## Màn không có application nav bar từ trước

Giữ bố cục và hành vi hiện có: `onboarding/splash`, `onboarding/onboarding` (Back/Skip đo chung với tranh, không có screen title/bell); `matching/matching`, `matching/match-result`, `active-date/date-finished`, `review/shared-result` (scene toàn màn, freshness/status/content heading); `deep-link/share-link`, `deep-link/not-found` (redirect/trạng thái lỗi); `date-plan/place-reviews-page` (redirect sang place detail). Calendar previous-month, card title, sheet heading và nút Back của form không phải app nav bar.

## Hành vi và enforcement

Route/back callback, giới hạn submit import, help-scroll, search area picker, report/save checked state, wizard Save/Exit, bộ đếm vote, dữ liệu/API, query keys và luồng form giữ nguyên. Thay đổi có chủ đích: chuẩn hoá chrome, bổ sung screen heading có role `header`, title i18n cho bar trước đây để trống, bell cho tab-root/sub-screen, bỏ bell ở sheet/modal; bỏ suppression `showUnread={false}` ở Settings. Wordmark dùng token chữ; avatar trên accent vẫn dùng `accent.onAccent` từ primitive hiện có.

Chỉ `HeaderNotificationButton` đọc unread; dot đúng khi `count > 0`, nhãn dùng `badgeLabel` và `more`, nhấn mở `/notifications`. Feature không được tự import/render bell hay BackHeader. AST check quét toàn bộ feature view, bắt back icon/button/bar tự dựng, yêu cầu AppHeader tại mọi host và wrapper tại mọi caller; kiểm kê route mới bắt buộc cập nhật. Intro controls và calendar previous-month là ngoại lệ có giới hạn cụ thể.

- `src/shared/ui/__tests__/app-header-ownership.test.ts:71`
- `src/shared/ui/__tests__/app-header.spec.tsx:16`

Jest kiểm tra unread 0/1/12 × more false/true × tab-root/sub-screen, thay đổi inbox trên cùng mounted header, bell route, back/Save, disabled, heading, safe-area, target 44pt và title trái với back + nhiều action ở đủ ba variant. Sheet không có bell/dot dù có unread; local action vẫn hoạt động. Regression tests kiểm tra cả hai chế độ selector và Assistant thực tế. AST enforcement yêu cầu mọi AppHeader trong selector/AssistantHeader dùng `variant="sheet"`, từ chối override `titleAlign` trong feature. Regression screen tests vẫn kiểm tra callbacks, query state và nội dung. Test Saved chỉ scope thứ tự heading theo nội dung, tách screen heading vừa thêm.

## Verification ban đầu (trước fix PR #538)

Baseline trước sửa: `pnpm test:ui --runInBand` — exit 0, 198 suites / 2,435 tests.

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | Exit 0 |
| `pnpm lint` | Exit 0, không warning/error |
| `pnpm test` | Exit 1: 135 file pass, 1 file fail, 1 skipped; 1,631 test pass, 3 fail, 39 skipped |
| `pnpm test src/shared/ui/__tests__/app-header-ownership.test.ts` | Exit 0, 42/42 |
| `pnpm test:ui --runInBand` | Exit 0: 198 suites, 2,448 tests; lặp lại full suite vẫn 198/2,448, không đổi timeout/config |
| `git diff --check` | Exit 0 |

Ba failure Vitest thuộc `distribute-wrapper.test.ts`: `refuses while the owner is alive`, `refuses recovery while a recorded build process group is still alive`, `keeps the lock and run files when a recorded build group is still alive after the child exits`. Sandbox từ chối `/bin/ps` (`operation not permitted`), khiến test không đọc được process start time/group. Cả test và `scripts/distribute.sh` giống hệt `ea0deb6` (hash bên dưới); không thay đổi code distribution hoặc skip/mock test để qua gate. Cần chạy lại `pnpm test` trong môi trường cho phép process inspection để xác nhận toàn bộ unit gate.

[Log tóm tắt và hash](issue-535-gates.txt). Không chạy simulator/device acceptance trong task này.

## Verification fix PR #538 — 2026-11-08

HEAD nền `d889888246a36061d715d5e712af19fdd0fac405`, patch chưa commit; không push. F-01/F-02 xử lý bằng variant `sheet` không bell, không thay đổi dismiss/navigation của sheet. Bỏ hoàn toàn prop `titleAlign`, layout đo hai cột và style centered; nhập link và đóng góp luôn dùng title trái.

Regression trước fix: 3 suite UI / 36 tests, 4 fail đúng tại bell trong shared sheet variant, picker standalone, picker embedded và Assistant welcome. Sau fix: 3/3 suite, 36/36 pass. Enforcement: 45/45 pass, gồm sheet variant ở mọi header trong hai host và cấm alignment override.

| Lệnh | Kết quả trên patch |
| --- | --- |
| `pnpm typecheck` | Exit 0 |
| `pnpm lint` | Exit 0, không warning/error |
| `pnpm test` | Exit 1: 135 file pass, 1 fail, 1 skipped; 1,634 test pass, 3 fail, 39 skipped |
| `pnpm test:ui --runInBand` | Exit 0: 198 suites / 2,447 tests |
| `git diff --check` | Exit 0 |

Ba Vitest failure vẫn thuộc distribution-wrapper và trùng tên/error ở baseline phía trên. Xác nhận trực tiếp `/bin/ps -o lstart= -p $$` bị sandbox từ chối (`operation not permitted`); `git diff HEAD --exit-code -- scripts/distribute.sh src/shared/config/__tests__/distribute-wrapper.test.ts` exit 0. Không sửa/skip/mock các test đó. Cần chạy full Vitest ở môi trường cho phép process inspection; chưa có simulator/device acceptance. UI test count giảm 1 do bỏ 6 case unread centered-title, thay test centered-layout bằng 3 case left-alignment + 1 sheet-action case, thêm 2 case picker.
