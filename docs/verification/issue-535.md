# GOGO-535 — một header dùng chung

Ngày 2026-11-08. Worktree `mobile-535`, nhánh `feature/GOGO-535-shared-header`, nền PR #534 tại `ea0deb6`. Không commit/push.

## Quyết định từ inventory

Đã grep toàn bộ `src/features` theo header/back/title/bell, kiểm tra route re-export trong `src/app`, và dùng Stitch MCP `list_screens` + `download_file` cho project `17315762413421369447`: 90 tài nguyên, 86 có HTML, tải thành công 86/86; 73 HTML có thẻ `<header>`. Bốn tài nguyên còn lại chỉ là ảnh. Snapshot giữ source screen ID, file ID, markup header, heading đầu và ngữ cảnh heading khi HTML không dùng thẻ header tại [issue-535-stitch-headers.json](issue-535-stitch-headers.json). Đây là inventory phục vụ header, không phải chứng nhận migration toàn project.

Hai variant tối thiểu:

- `tab-root`: wordmark i18n `splash.brand`, tên màn i18n, bell; hàng tối thiểu 64pt. Nguồn Stitch Home `1141223353674973688`, Plans `15334143905524313049`, Profile `9700245316043548900`, Saved `6045502163558025217`.
- `sub-screen`: back 44pt, tên màn, bell; hàng tối thiểu 56pt, title trái mặc định, `titleAlign="center"` cho nhập link và đóng góp. Hai cột bên được đo để title ở giữa màn dù phía phải có Help + bell. Nguồn nhập link `a3500cc50aef4fbab76bf4587a8f6b20`, đóng góp `d9a8855514e94eb395b5b37e99a09129` / `303754ee1bc84f31b5405ad394c7ea81`, place detail `1593725092880141532`, saved city `5cd4c60b8f2e4236bb8d8b577befd489`.

Không tạo variant large-title: Plans trong Stitch dùng header compact 64pt có wordmark, không dùng display title. Display heading cũ trong Plans được thay bằng tab-root.

`rightAction` nhận một hoặc nhiều action cạnh bell; `AppHeaderAction` áp cùng target, trạng thái disabled/pressed và nhãn a11y. #537 có thể truyền action “Lưu” mà không tự dựng bar. `titleAccessory` giữ khu vực, số địa điểm; `leading` giữ avatar/Close của AI. `subtitleTone` giữ trạng thái offline. Modal AI và selector hành chính dùng `safeArea={false}` vì container đã xử lý inset; màn ứng dụng để header sở hữu top/left/right safe-area.

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
| Thêm địa điểm | `src/features/place-import/import.view.tsx:279` | sub-screen, giữa khi nhập link; trái sau xác minh |
| Chi tiết địa điểm | `src/features/date-plan/place-detail.view.tsx:90` | sub-screen, trái + báo sai/lưu |
| Đóng góp của tôi | `src/features/contributions/my-contributions.view.tsx:159` | sub-screen, giữa |
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

Route/back callback, giới hạn submit import, help-scroll, search area picker, report/save checked state, wizard Save/Exit, bộ đếm vote, dữ liệu/API, query keys và luồng form giữ nguyên. Thay đổi có chủ đích: chuẩn hoá chrome, bổ sung screen heading có role `header`, title i18n cho bar trước đây để trống, bell cho mọi app header; bỏ suppression `showUnread={false}` ở Settings. Wordmark dùng token chữ; avatar trên accent vẫn dùng `accent.onAccent` từ primitive hiện có.

Chỉ `HeaderNotificationButton` đọc unread; dot đúng khi `count > 0`, nhãn dùng `badgeLabel` và `more`, nhấn mở `/notifications`. Feature không được tự import/render bell hay BackHeader. AST check quét toàn bộ feature view, bắt back icon/button/bar tự dựng, yêu cầu AppHeader tại mọi host và wrapper tại mọi caller; kiểm kê route mới bắt buộc cập nhật. Intro controls và calendar previous-month là ngoại lệ có giới hạn cụ thể.

- `src/shared/ui/__tests__/app-header-ownership.test.ts:71`
- `src/shared/ui/__tests__/app-header.spec.tsx:16`

Jest kiểm tra unread 0/1/12 × more false/true × tab-root/sub-left/sub-center, thay đổi inbox trên cùng mounted header, bell route, back/Save, disabled, heading, safe-area, target 44pt và căn giữa khi có hai action. Regression screen tests vẫn kiểm tra callbacks, query state và nội dung. Test Saved chỉ scope thứ tự heading theo nội dung, tách screen heading vừa thêm.

## Verification

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
