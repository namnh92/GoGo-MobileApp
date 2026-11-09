# GoGo-MobileApp #562 change report

Branch: `feature/GOGO-562-permissions-copy`. UI-only. No commit or push.

Stitch references: project `17315762413421369447`, title `Quyền và dữ liệu - GoGo`, screens `16507289014630550696` and `6458166590678622329`.

The system row now centers its title vertically. Location and notification headings have a minimum 40pt title box matching their icon tile, independent of wrapped status/helper copy. The granted-location inline action removes horizontal button padding and aligns its icon/text group to the left of the body copy. Existing semantic colors and touch targets are retained.

## Changed files and lines

- [src/features/__tests__/account-defaults.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/account-defaults.spec.tsx:128): 128, 130, 161
- [src/features/__tests__/administrative-picker.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/administrative-picker.spec.tsx:99): 99
- [src/features/__tests__/contribution-wizard.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/contribution-wizard.spec.tsx:135): 135, 167, 252, 285, 364, 419, 429, 464, 534, 682, 692, 831, 835
- [src/features/__tests__/location-settings.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/location-settings.spec.tsx:1): 1, 18, 71, 97, 99, 109, 120, 132
- [src/features/__tests__/notification-settings.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/notification-settings.spec.tsx:116): 116, 118, 131, 138, 155, 168, 170, 174
- [src/features/__tests__/place-import-owner.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/place-import-owner.spec.tsx:90): 90, 97, 112, 162, 634, 638, 671, 686, 691
- [src/features/__tests__/place-import-resolution-token.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/place-import-resolution-token.spec.tsx:160): 160, 260, 307, 315
- [src/features/__tests__/profile-keo-count.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/profile-keo-count.spec.tsx:114): 114
- [src/features/__tests__/settings-permissions.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/__tests__/settings-permissions.spec.tsx:50): 50, 55
- [src/features/notifications/notification-switch.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/notifications/notification-switch.style.tsx:21): 21, 37
- [src/features/notifications/notification-switch.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/notifications/notification-switch.view.tsx:89): 89, 95
- [src/features/settings/location-permission.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/settings/location-permission.style.tsx:7): 7, 19
- [src/features/settings/location-permission.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/settings/location-permission.view.tsx:98): 98, 123
- [src/features/settings/permissions.style.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/settings/permissions.style.tsx:7): 7
- [src/features/settings/permissions.view.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/features/settings/permissions.view.tsx:74): 74
- [src/shared/config/__tests__/tracking-permission.test.ts](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/config/__tests__/tracking-permission.test.ts:114): 114, 123
- [src/shared/i18n/en.ts](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:13): 13, 23, 26, 30, 59, 62, 289, 311, 325, 329, 395, 397, 401, 471, 1099, 1103, 1278, 1284, 1291, 1294, 1321, 1328, 1330, 1333, 1569, 1584, 1595, 1597, 1610, 1613, 1671
- [src/shared/i18n/vi.ts](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:4): 4, 15, 18, 22, 51, 54, 61, 63, 193, 210, 247, 252, 280, 286, 302, 316, 320, 386, 388, 392, 464, 658, 1093, 1097, 1272, 1278, 1285, 1315, 1322, 1324, 1327, 1566, 1581, 1592, 1607, 1610, 1668
- [src/shared/location/current-area-sheet.spec.tsx](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/location/current-area-sheet.spec.tsx:34): 34, 39, 41, 56, 85, 95, 106, 118
- [src/shared/i18n/sentence-case.test.ts](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/sentence-case.test.ts:1): 1

## vi: 50 strings

| Key and line | Before | After |
| --- | --- | --- |
| [g11.profileHeading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:4) | Cá Nhân | Cá nhân |
| [g11.settingsTitle](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:5) | Cài Đặt & Thông Báo | Cài đặt & thông báo |
| [g11.previewTabs](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:15) | Mô phỏng thanh điều hướng (Bottom Bar) | Mô phỏng thanh điều hướng (bottom bar) |
| [g11.experienceHeading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:18) | Trải nghiệm & Hỗ trợ | Trải nghiệm & hỗ trợ |
| [g11.analytics](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:22) | Dữ liệu phân tích & Cài đặt | Dữ liệu phân tích & cài đặt |
| [g11.signIn](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:51) | Đăng nhập / Đăng ký | Đăng nhập / đăng ký |
| [g11.settings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:54) | Cài đặt & Tiện ích | Cài đặt & tiện ích |
| [g11.openSystem](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:61) | Mở Cài đặt hệ thống | Mở cài đặt hệ thống |
| [g11.systemHeading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:63) | Quản lý trong Cài đặt máy | Quản lý trong cài đặt máy |
| [discovery.moods](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:193) | Tâm trạng & Trải nghiệm | Tâm trạng & trải nghiệm |
| [discovery.home](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:210) | Trang Chủ | Trang chủ |
| [discovery.amenities](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:247) | Tiện ích & Trạng thái | Tiện ích & trạng thái |
| [discovery.priceHigh](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:252) | Ẩm thực / Quán bar cao cấp (250k - 600k) | Ẩm thực / quán bar cao cấp (250k - 600k) |
| [onboarding.art.district1](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:280) | Quận 1 • Cà phê & Đọc sách | Quận 1 • Cà phê & đọc sách |
| [onboarding.art.stop1Body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:286) | Ẩm thực đương đại ấm cúng, nhạc Jazz êm | Ẩm thực đương đại ấm cúng, nhạc jazz êm |
| [auth.hostBadge](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:302) | Dành riêng cho Host | Dành riêng cho host |
| [areaPicker.selectProvince](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:316) | Chọn Tỉnh / Thành phố | Chọn tỉnh / thành phố |
| [areaPicker.selectCommune](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:317) | Chọn Phường / Xã | Chọn phường / xã |
| [areaPicker.provinceFirst](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:318) | Vui lòng chọn Tỉnh / Thành phố trước | Vui lòng chọn tỉnh / thành phố trước |
| [administrative.province](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:320) | Tỉnh/Thành phố | Tỉnh/thành phố |
| [administrative.commune](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:321) | Phường/Xã | Phường/xã |
| [account.avatarCameraUnavailable](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:386) | Chưa dùng được máy ảnh. Bạn có thể chọn từ thư viện hoặc cho phép máy ảnh trong Cài đặt. | Chưa dùng được máy ảnh. Bạn có thể chọn từ thư viện hoặc cho phép máy ảnh trong cài đặt. |
| [mediaPermission.cameraDeniedBody](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:388) | GoGo cần quyền máy ảnh để bạn chụp ảnh đại diện. Bạn có thể cho phép trong Cài đặt hoặc chọn ảnh từ thư viện. | GoGo cần quyền máy ảnh để bạn chụp ảnh đại diện. Bạn có thể cho phép trong cài đặt hoặc chọn ảnh từ thư viện. |
| [mediaPermission.libraryDeniedBody](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:392) | GoGo cần quyền truy cập ảnh để bạn chọn ảnh đại diện. Bạn có thể cho phép trong Cài đặt hoặc chụp ảnh mới. | GoGo cần quyền truy cập ảnh để bạn chọn ảnh đại diện. Bạn có thể cho phép trong cài đặt hoặc chụp ảnh mới. |
| [account.avatarPermissionDenied](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:464) | Chưa có quyền truy cập ảnh. Cho phép trong Cài đặt rồi thử lại. | Chưa có quyền truy cập ảnh. Cho phép trong cài đặt rồi thử lại. |
| [createMood.moodTitle](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:658) | Tâm trạng & Trải nghiệm | Tâm trạng & trải nghiệm |
| [consent.tracking.body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1093) | Ở bước tiếp theo, iPhone sẽ hỏi bạn có cho GoGo theo dõi không. Nếu bạn cho phép, GoGo dùng mã quảng cáo của thiết bị để biết lời mời hay liên kết nào đã đưa bạn đến, và để đo hiệu quả quảng cáo của GoGo. Từ chối thì mọi tính năng vẫn dùng bình thường; GoGo vẫn đo lượt cài đặt và mở app, nhưng không kèm mã quảng cáo. Bạn đổi lại được trong Cài đặt. | Ở bước tiếp theo, iPhone sẽ hỏi bạn có cho GoGo theo dõi không. Nếu bạn cho phép, GoGo dùng mã quảng cáo của thiết bị để biết lời mời hay liên kết nào đã đưa bạn đến, và để đo hiệu quả quảng cáo của GoGo. Từ chối thì mọi tính năng vẫn dùng bình thường; GoGo vẫn đo lượt cài đặt và mở app, nhưng không kèm mã quảng cáo. Bạn đổi lại được trong cài đặt. |
| [consent.tracking.android.body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1097) | Nếu bạn cho phép, GoGo dùng mã quảng cáo của thiết bị để biết lời mời hay liên kết nào đã đưa bạn đến, và để đo hiệu quả quảng cáo của GoGo. Không cho phép thì mọi tính năng vẫn dùng bình thường; GoGo vẫn đo lượt cài đặt và mở app, nhưng không kèm mã quảng cáo. Bạn đổi lại được trong Cài đặt → Quyền và dữ liệu. | Nếu bạn cho phép, GoGo dùng mã quảng cáo của thiết bị để biết lời mời hay liên kết nào đã đưa bạn đến, và để đo hiệu quả quảng cáo của GoGo. Không cho phép thì mọi tính năng vẫn dùng bình thường; GoGo vẫn đo lượt cài đặt và mở app, nhưng không kèm mã quảng cáo. Bạn đổi lại được trong cài đặt → Quyền và dữ liệu. |
| [placeWizard.option.work_reading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1272) | Làm việc / Đọc sách | Làm việc / đọc sách |
| [placeWizard.option.pets_allowed](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1278) | Cho phép mang thú cưng (Pet-friendly) | Cho phép mang thú cưng (pet-friendly) |
| [placeWizard.step1](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1285) | 1. Giá & Mục đích | 1. Giá & mục đích |
| [placeWizard.step2](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1286) | 2. Tiện ích & Vibe | 2. Tiện ích & vibe |
| [placeWizard.step3](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1287) | 3. Menu & Bill | 3. Menu & bill |
| [placeWizard.heading1](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1288) | Mức giá & Mục đích phù hợp | Mức giá & mục đích phù hợp |
| [placeWizard.heading2](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1289) | 2. Không gian & Tiện ích thực tế | 2. Không gian & tiện ích thực tế |
| [placeWizard.heading3](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1290) | Menu, Hoá đơn & Mẹo thực tế | Menu, hoá đơn & mẹo thực tế |
| [placeWizard.vibes](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1315) | Vibe & Không gian thực tế | Vibe & không gian thực tế |
| [placeWizard.uploadPhotos](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1322) | + Tải thêm ảnh menu/bill (Tối đa 5 ảnh) | + Tải thêm ảnh menu/bill (tối đa 5 ảnh) |
| [placeWizard.tipsHeading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1324) | Món ngon phải thử & Mẹo khi ghé | Món ngon phải thử & mẹo khi ghé |
| [placeWizard.ratings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1327) | Đánh giá phục vụ & Không gian | Đánh giá phục vụ & không gian |
| [devicePromotions.sheet.body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1566) | GoGo có thể gửi ưu đãi chung đến máy này, kể cả khi bạn chưa đăng nhập.\n\nMã thông báo đẩy của máy đi tới OneSignal để gửi thông báo. GoGo nhận một mã thiết bị ngẫu nhiên, nền tảng máy, mã đăng ký thông báo và trạng thái công tắc; không có gì về tài khoản.\n\nĐổi lại được trong Cài đặt → Quyền và dữ liệu. Máy không còn hoạt động thì dữ liệu này được xoá sau khoảng 90 ngày, cộng 1 giờ và 30 ngày; nếu bước dọn dữ liệu lỗi, việc xoá chờ tới khi xử lý xong. | GoGo có thể gửi ưu đãi chung đến máy này, kể cả khi bạn chưa đăng nhập.\n\nMã thông báo đẩy của máy đi tới OneSignal để gửi thông báo. GoGo nhận một mã thiết bị ngẫu nhiên, nền tảng máy, mã đăng ký thông báo và trạng thái công tắc; không có gì về tài khoản.\n\nĐổi lại được trong cài đặt → Quyền và dữ liệu. Máy không còn hoạt động thì dữ liệu này được xoá sau khoảng 90 ngày, cộng 1 giờ và 30 ngày; nếu bước dọn dữ liệu lỗi, việc xoá chờ tới khi xử lý xong. |
| [permissionsSettings.trackingIos](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1581) | iOS quản lý quyền theo dõi của GoGo trong Cài đặt. | iOS quản lý quyền theo dõi của GoGo trong cài đặt. |
| [permissionsSettings.openSettings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1582) | Mở Cài đặt | Mở cài đặt |
| [permissionsSettings.areaInDefaults](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1583) | Chọn khu vực trong Cài đặt mặc định | Chọn khu vực trong cài đặt mặc định |
| [notificationSettings.pushNote](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1592) | Thông báo cho GoGo đang tắt trong Cài đặt của máy này. Dù công tắc ở trên đang bật, máy này sẽ không hiển thị thông báo cho tới khi bạn cho phép. | Thông báo cho GoGo đang tắt trong cài đặt của máy này. Dù công tắc ở trên đang bật, máy này sẽ không hiển thị thông báo cho tới khi bạn cho phép. |
| [notificationSettings.openSettings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1593) | Mở Cài đặt thông báo | Mở cài đặt thông báo |
| [notificationSettings.openSettingsFailed](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1594) | Không mở được Cài đặt. Vui lòng mở Cài đặt hệ thống và chọn GoGo. | Không mở được cài đặt. Vui lòng mở cài đặt hệ thống và chọn GoGo. |
| [locationSettings.status.denied](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1607) | Đang tắt trong Cài đặt. Bạn vẫn chọn khu vực thủ công được. | Đang tắt trong cài đặt. Bạn vẫn chọn khu vực thủ công được. |
| [locationSettings.openSettings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1610) | Mở Cài đặt | Mở cài đặt |
| [assistant.composer.photoDenied](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/vi.ts:1668) | Cho phép truy cập ảnh trong Cài đặt để đính kèm. | Cho phép truy cập ảnh trong cài đặt để đính kèm. |

## en: 38 strings

| Key and line | Before | After |
| --- | --- | --- |
| [g11.settingsTitle](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:13) | Settings & Notifications | Settings & notifications |
| [g11.previewTabs](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:23) | Navigation bar preview (Bottom Bar) | Navigation bar preview (bottom bar) |
| [g11.experienceHeading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:26) | Experience & Support | Experience & support |
| [g11.analytics](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:30) | Analytics & Settings | Analytics & settings |
| [g11.signIn](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:59) | Sign in / Register | Sign in / register |
| [g11.settings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:62) | Settings & Utilities | Settings & utilities |
| [onboarding.art.district1](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:289) | District 1 • Coffee & Reading | District 1 • Coffee & reading |
| [areaPicker.selectProvince](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:325) | Choose Province / City | Choose province / city |
| [areaPicker.selectCommune](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:326) | Choose Ward / Commune | Choose ward / commune |
| [areaPicker.provinceFirst](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:327) | Please choose a Province / City first | Please choose a province / city first |
| [administrative.province](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:329) | Province/City | Province/city |
| [administrative.commune](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:330) | Ward/Commune | Ward/commune |
| [account.avatarCameraUnavailable](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:395) | Camera unavailable. Choose from your library or allow camera access in Settings. | Camera unavailable. Choose from your library or allow camera access in settings. |
| [mediaPermission.cameraDeniedBody](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:397) | GoGo needs camera access so you can take an avatar photo. Allow access in Settings or choose from your library. | GoGo needs camera access so you can take an avatar photo. Allow access in settings or choose from your library. |
| [mediaPermission.libraryDeniedBody](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:401) | GoGo needs photo access so you can choose an avatar. Allow access in Settings or take a new photo. | GoGo needs photo access so you can choose an avatar. Allow access in settings or take a new photo. |
| [account.avatarPermissionDenied](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:471) | No access to your photos. Allow it in Settings and try again. | No access to your photos. Allow it in settings and try again. |
| [consent.tracking.body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1099) | Next, your iPhone will ask whether GoGo may track you. If you allow it, GoGo uses your device's advertising identifier to know which invite or link brought you here, and to measure GoGo's ads. If you decline, every feature still works; GoGo still measures installs and app opens, but without the advertising identifier. You can change this in Settings. | Next, your iPhone will ask whether GoGo may track you. If you allow it, GoGo uses your device's advertising identifier to know which invite or link brought you here, and to measure GoGo's ads. If you decline, every feature still works; GoGo still measures installs and app opens, but without the advertising identifier. You can change this in settings. |
| [consent.tracking.android.body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1103) | If you allow it, GoGo uses your device's advertising identifier to know which invite or link brought you here, and to measure GoGo's ads. If you don't allow it, every feature still works; GoGo still measures installs and app opens, but without the advertising identifier. You can change this in Settings → Permissions and data. | If you allow it, GoGo uses your device's advertising identifier to know which invite or link brought you here, and to measure GoGo's ads. If you don't allow it, every feature still works; GoGo still measures installs and app opens, but without the advertising identifier. You can change this in settings → Permissions and data. |
| [placeWizard.option.work_reading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1278) | Work / Reading | Work / reading |
| [placeWizard.step1](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1291) | 1. Price & Purpose | 1. Price & purpose |
| [placeWizard.step2](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1292) | 2. Amenities & Vibe | 2. Amenities & vibe |
| [placeWizard.heading1](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1294) | Actual price & Suitable occasions | Actual price & suitable occasions |
| [placeWizard.heading2](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1295) | 2. Space & Actual amenities | 2. Space & actual amenities |
| [placeWizard.heading3](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1296) | Menu, Receipts & Practical tips | Menu, receipts & practical tips |
| [placeWizard.vibes](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1321) | Vibe & Actual space | Vibe & actual space |
| [placeWizard.tipsHeading](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1330) | Must-try dishes & Visiting tips | Must-try dishes & visiting tips |
| [placeWizard.ratings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1333) | Service & Space rating | Service & space rating |
| [devicePromotions.sheet.body](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1569) | GoGo can send general offers to this device, even when you are not signed in.\n\nThe device\'s push token goes to OneSignal to deliver notifications. GoGo receives a random device id, the platform, the push subscription id and the switch state; nothing about an account.\n\nChange this in Settings → Permissions and data. If the device goes quiet, this data is deleted after about 90 days, plus 1 hour and 30 days; if the cleanup step fails, deletion waits until that is resolved. | GoGo can send general offers to this device, even when you are not signed in.\n\nThe device\'s push token goes to OneSignal to deliver notifications. GoGo receives a random device id, the platform, the push subscription id and the switch state; nothing about an account.\n\nChange this in settings → Permissions and data. If the device goes quiet, this data is deleted after about 90 days, plus 1 hour and 30 days; if the cleanup step fails, deletion waits until that is resolved. |
| [permissionsSettings.trackingIos](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1584) | iOS manages GoGo's tracking permission in Settings. | iOS manages GoGo's tracking permission in settings. |
| [permissionsSettings.openSettings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1585) | Open Settings | Open settings |
| [notificationSettings.pushNote](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1595) | Notifications for GoGo are off in this device\'s Settings. Even with the switch above on, this device will not show notifications until you allow them. | Notifications for GoGo are off in this device\'s settings. Even with the switch above on, this device will not show notifications until you allow them. |
| [notificationSettings.openSettingsFailed](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1597) | Could not open Settings. Open system Settings and select GoGo. | Could not open settings. Open system settings and select GoGo. |
| [locationSettings.status.denied](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1610) | Turned off in Settings. You can still pick an area by hand. | Turned off in settings. You can still pick an area by hand. |
| [locationSettings.openSettings](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1613) | Open Settings | Open settings |
| [assistant.composer.photoDenied](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1671) | Allow photo access in Settings to attach a photo. | Allow photo access in settings to attach a photo. |
| [auth.hostBadge](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:311) | For Hosts | For hosts |
| [placeWizard.option.pets_allowed](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1284) | Pets welcome (Pet-friendly) | Pets welcome (pet-friendly) |
| [placeWizard.uploadPhotos](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-548/src/shared/i18n/en.ts:1328) | + Add menu/receipt photos (Up to 5) | + Add menu/receipt photos (up to 5) |

## Validation

- `pnpm typecheck`: exit 0. [Log](/tmp/562-typecheck.log).
- `pnpm lint`: exit 0. [Log](/tmp/562-lint.log).
- `pnpm test`: 1678 passed, 39 skipped; only the 3 known distribute-wrapper sandbox lock tests failed (exit 1). [Log](/tmp/562-test.log).
- `pnpm test:ui --runInBand`: 208 suites / 2800 tests passed, exit 0. [Log](/tmp/562-test-ui.log).
- Final focused location/system alignment tests: 2 suites / 13 tests passed. [Log](/tmp/562-alignment.log).
- Sentence-case regression: catalog audit failed before copy changes and passes afterward; proper nouns, screen references, sentence/list boundaries and quoted labels remain permitted.
- `git diff --check`: passed.

Layout corrections are independent of the selected theme; existing role-based colors are retained. No native simulator visual inspection was performed. No commit or push.
