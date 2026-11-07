# G11 — Hồ sơ & cài đặt (#529)

## Phạm vi và nguồn

- Worktree `mobile-g11`, branch `feature/GOGO-529-redesign-g11-profile`, base `c9043b3` (`re-design`), HEAD `3c9c428` + dirty patch F-01. Không install/commit/push.
- Nguồn giao diện: đã đọc cả HTML và PNG của `dev/handoffs/stitch-g11/11.1` đến `11.5`; kế hoạch `dev/handoffs/g11-plan.md` §1, §2, §4.
- Quyết định owner **2026-11-08**: [#529 comment 6710656834](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834), đã đọc lại trực tiếp từ GitHub trong lượt F-01.
- Light theo bố cục Stitch và semantic tokens hiện có. Dark theo tokens, ngoại lệ owner **2026-11-07** tại [#529](https://github.com/namnh92/GoGo-MobileApp/issues/529). Không có cặp Dark riêng trong bộ local.
- Không thay OpenAPI, endpoint, authorization hoặc cơ chế phiên/cache. Dùng các hook và DTO được sinh hiện có.

## Stitch → app

| Stitch | App / nguồn dữ liệu | Kiểm chứng tự động |
|---|---|---|
| 11.1 Khách | Header GoGo/Cá nhân + chuông; hồ sơ khách; card đăng nhập cho cả anonymous và guest; shortcuts theo quyền hiện hành; Quyền và Màu dùng được không cần tài khoản | `profile-keo-count.spec.tsx`: không lộ profile cache cho guest, khoá Saved/Reviews với lý do + CTA; Kèo vẫn mở Sắp tới |
| 11.2 User | Avatar/tên/email từ `/me`, thành phố từ `homeAdministrativeArea.provinceName`, chip mood có nhãn taxonomy; Saved/Reviews là độ dài mảng đầy đủ; giữ Đóng góp | Kiểm tra nhãn taxonomy, số 0 thật, không placeholder, không tổng Kèo hoặc badge unread |
| 11.2 Banner | Room có lịch tương lai gần nhất từ **toàn bộ các trang** `/rooms` ở trạng thái Sắp tới hiện có; so `startAt`, fallback `scheduledDate`; bỏ lịch thiếu/sai/quá khứ và trạng thái kết thúc | `profile-upcoming.spec.tsx`: trang sau có room gần hơn, pagination lỗi/retry, không lộ cache sau đổi actor |
| 11.2 Đích banner | Ready/active có `planId` → plan; phòng còn quyết định hoặc chưa có plan → lobby, cùng semantics màn Kế hoạch | Test cả hai đích |
| 11.3 Mặc định | Route riêng `/settings/defaults`; intro → một khu vực hành chính → ngân sách radio / người → mood chips + số đã chọn → CTA; chỉ PATCH trường thay đổi | `account-defaults.spec.tsx`: payload chuẩn tỉnh/phường/version, clear null, custom budget giữ nguyên khi chỉ đổi mood, lỗi giữ draft |
| 11.4 Màu | Route riêng `/settings/theme`; bốn swatch có tên/mô tả/check; preview trong `ScopedTheme`; Apply mới lưu AsyncStorage key hiện có và đổi runtime; thành công/lỗi qua ResultSheet | `account-theme-accent.spec.tsx`: chọn chưa lưu, rời màn không lưu, Apply, bootstrap muộn, storage lỗi + retry, preview không có button |
| 11.5 Quyền | Header back + chuông, intro, các section account/OS/device hiện có, card mở Settings hệ thống có lỗi riêng, metadata phiên bản thật | Các suite notifications/location/device promotions/tracking/settings-permissions |
| Đăng xuất/xoá | Secondary logout + Sheet xác nhận; huỷ không gọi provider; lỗi logout giữ nguyên phân loại và actor tagging; delete trong Account giữ xác nhận, nền card trung tính | `profile-sign-out-failure.spec.tsx`, `profile-keo-count.spec.tsx`, các suite session/logout/account |
| Điều hướng/quan sát | Route files là thin re-export, shared settings shell; thêm hai route vào danh sách screen template được phép | `screen-tag.spec.tsx`, `i18n-keys.spec.tsx` |

## Astra r1 F-01 — đối chiếu native tại `3c9c428`

**4/5 screens compared** — 11.2–11.5, mỗi màn có Light + Dark. **11.1 Khách: NOT MEASURED** ở cả hai theme, chưa có ảnh native signed-out. Đây là số màn có viewport được đối chiếu, **không phải** 4/5 màn đã đạt pixel parity hoặc full-page acceptance.

- HEAD ảnh do Claude cung cấp: `3c9c428017bd21b5f08cddb9ffdd8eb46c301027`, Metro phục vụ worktree này. Ảnh được đọc trực tiếp trong lượt sửa F-01 ngày **2026-11-08**.
- [Bảng ảnh đặt cạnh nhau — Stitch Light / Native Light / Native Dark](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/comparison-3c9c428.html), chứa nguyên bytes của 12 PNG, không dựng ảnh app bằng renderer test. [Danh sách nguồn, kích thước và SHA-256](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/comparison-sources-3c9c428.json).
- Native là `1206×2622 px`, tương ứng `402×874 pt @3x`, có status bar/safe area iOS. Stitch là ảnh trang có chiều cao khác. So theo thành phần và kích thước CSS/pt trong HTML, không tính status bar, giờ và vị trí fold thành sai lệch nội dung. Không crop hoặc kéo giãn ảnh để tạo kết quả khớp giả.
- Dark so **thứ tự/layout/nội dung với Stitch Light**, màu với semantic Dark tokens, theo owner **2026-11-07** trong [#529](https://github.com/namnh92/GoGo-MobileApp/issues/529). Không có PNG Stitch Dark riêng để tuyên bố pixel diff Dark.
- Các thay đổi dưới đây là **dirty patch trên `3c9c428`**. Ảnh đầu vào chỉ chứng minh FAIL-before/quan sát trước sửa. Chưa có ảnh native chứa patch; không gán lại ảnh cũ làm PASS-after. `simctl` bị sandbox chặn CoreSimulatorService; Computer Use cũng không được cấp quyền Simulator trong lượt này.

### Bảng screen × theme và đường dẫn ảnh

| Màn | Theme | Stitch Light (tham chiếu) | Native đúng HEAD | Kết quả so ở viewport / xử lý |
|---|---|---|---|---|
| 11.1 Khách | Light | [11.1-ca-nhan-khach.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.1-ca-nhan-khach.png) | Chưa có | NOT MEASURED; cần trạng thái signed-out |
| 11.1 Khách | Dark | [11.1-ca-nhan-khach.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.1-ca-nhan-khach.png) + Dark tokens | Chưa có | NOT MEASURED |
| 11.2 Cá nhân | Light | [11.2-ca-nhan.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.2-ca-nhan.png) | [11.2-ca-nhan-light.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.2-ca-nhan-light.png) | COMPARED; V01–V04 sửa source; còn E01/E02/E05/E06 |
| 11.2 Cá nhân | Dark | [11.2-ca-nhan.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.2-ca-nhan.png) + Dark tokens | [11.2-ca-nhan-dark.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.2-ca-nhan-dark.png) | COMPARED; cùng layout Light; avatar trống cần native recheck sau V09 |
| 11.3 Mặc định | Light | [11.3-mac-dinh-tao-keo.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.3-mac-dinh-tao-keo.png) | [11.3-mac-dinh-light.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.3-mac-dinh-light.png) | COMPARED; V01/V05 sửa source; E03; U01 chưa được duyệt |
| 11.3 Mặc định | Dark | [11.3-mac-dinh-tao-keo.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.3-mac-dinh-tao-keo.png) + Dark tokens | [11.3-mac-dinh-dark.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.3-mac-dinh-dark.png) | COMPARED; cùng V05/E03/U01; màu theo E07 |
| 11.4 Màu | Light | [11.4-mau-chu-de.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.4-mau-chu-de.png) | [11.4-mau-light.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.4-mau-light.png) | COMPARED; V01/V06/V07 sửa source; E04; U01 |
| 11.4 Màu | Dark | [11.4-mau-chu-de.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.4-mau-chu-de.png) + Dark tokens | [11.4-mau-dark.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.4-mau-dark.png) | COMPARED; cùng V06/V07/E04/U01; E07 |
| 11.5 Quyền | Light | [11.5-quyen-du-lieu.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.5-quyen-du-lieu.png) | [11.5-quyen-light.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.5-quyen-light.png) | COMPARED; V01/V08 sửa source; E05/E08; U01 |
| 11.5 Quyền | Dark | [11.5-quyen-du-lieu.png](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/stitch-g11/11.5-quyen-du-lieu.png) + Dark tokens | [11.5-quyen-dark.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/11.5-quyen-dark.png) | COMPARED; cùng V08/E05/E08/U01; E07 |

### So từng thành phần — sai lệch đã sửa trong source

Mọi hàng áp cùng layout cho Light/Dark. “Sửa source” không có nghĩa đã đo lại trên Simulator.

| ID | Thành phần | Quan sát tại `3c9c428` so Stitch | Sửa trong patch |
|---|---|---|---|
| V01 | Header 11.2–11.5; gutters/card/type | Tên profile quá nặng; card/row bo lớn, bóng rộng; subpage dùng title riêng và back dạng chevron có nền/viền | Dùng typography Stitch hiện có; header settings chung; back arrow 24pt, target 44pt không viền; gutter 16pt, gap nhóm 24pt, card radius 12pt và shadow-sm token riêng cho G11 |
| V02 | 11.2 identity và mood chips | Edit là sliders trong nút viền; name 22 extra-bold; city cùng cỡ email; chips wrap | Bút edit; name 17 semibold, city caption; chips một dòng, horizontal scroll, nền container theo token |
| V03 | 11.2 ba shortcut | Tất cả icon nền cam, radius card lớn và count quá nặng | Bookmark filled; nhóm màu violet; review có hotel-class icon/nền trung tính; icon 36pt, count 17pt, card/padding compact |
| V04 | 11.2 danh sách, banner, logout và dock | Rows padding dọc 16pt + divider; nhiều icon sai; inbox/account copy ngắn hơn mẫu; reviews chỉ số; thiếu dot màu; dock Home/user sai hình/active tint | Rows 52pt (36pt icon + 8pt mỗi phía), bỏ divider; Material icons; copy/subtitle đúng; giữ bốn dòng Stitch trước Contributions; dot màu thật; banner violet; secondary logout có icon; chỉ tại tab Profile dùng compass/user outline và màu chữ dock theo Stitch |
| V05 | 11.3 intro, section headings, budget, mood count, guidance, Save | Intro lặp tên route; các heading nằm trong card, count riêng dòng; radio thiếu icon; note là text trần; Save nằm cuối scroll | Intro “Cá nhân hoá trải nghiệm”; heading/icon/helper trên card; selected count cạnh heading; radio có icon và selected tint; chip soft có check + nhãn; panel hướng dẫn violet; CTA “Lưu thiết lập mặc định” trong shared GlassBar cố định. Không đổi payload hoặc lựa chọn budget/mood |
| V06 | 11.4 intro, palette, ring | Thiếu pill “Cá nhân hoá giao diện”; selected name chỉ “Cam”; ring viền cứng thay soft halo; palette shadow/radius khác | Thêm pill, title/body theo Stitch; “Cam GoGo”; outer 56pt / inner 48pt, soft halo + check; gap section và card material theo nguồn |
| V07 | 11.4 preview, sample actions, tabs, Apply | Khung có viền accent và nền quá đậm; tile nhỏ; bookmark trần; share/detail thiếu icon; thiếu caption tab và selected dot; Apply bo chữ nhật | Bỏ viền, nền low; tile 80pt; bookmark trong circle; thêm share/info; caption Bottom Bar và dot selected. Reuse pill variant trong button family, giữ accent runtime. Preview vẫn minh hoạ và không có button tương tác theo E04 |
| V08 | 11.5 intro, device/analytics/system grouping | Thiếu shield intro; Notification và Location thành hai nhóm độc lập nhiều nested card/bóng/khoảng trống; thiếu system icon, CTA outlined | Intro có shield violet; gộp trong một nhóm/card “Quyền thiết bị”; giữ phân biệt account push và OS thật, cùng tất cả retry/errors/Settings actions; analytics/system tách nhóm, system icon + primary pill. Không đổi hooks/permission/session/consent |
| V09 | 11.2 Dark avatar | Capture không thấy initial M, Light có M. Code cũ bỏ initials ngay khi có URL, nên ảnh chưa tải xong có thể để trống | Giữ initials khi ảnh còn loading; ảnh phủ lên và chỉ bỏ fallback sau onLoad. Regression test FAIL-before, PASS-after. Chưa khẳng định đây là nguyên nhân duy nhất của capture Dark; cần native recheck |

Các phần dưới fold không có ảnh: 11.2 experience/AI/logout/version, 11.3 cuối budgets/moods/note/Save, 11.4 helper cuối màn, 11.5 tracking/system/version. Chúng đã đối chiếu HTML và sửa source khi thuộc V04–V08, nhưng **NOT MEASURED native**; không coi phần source review này là ảnh toàn trang. Không có ảnh SE, chữ lớn, VoiceOver/TalkBack hoặc phép đo contrast trên thiết bị.

### Sai lệch còn lại — ngoại lệ có căn cứ

| ID | Màn/theme | Sai lệch còn lại so mẫu | Ngoại lệ đã duyệt / nguồn chính xác |
|---|---|---|---|
| E01 | 11.2 L/D | Không check/uy tín/cấp, không tổng Kèo, không unread dot/“2 mới” | Owner **2026-11-08**, [#529 comment 6710656834 §1](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834), chờ [BE#809](https://github.com/namnh92/GoGo-BE/issues/809) |
| E02 | 11.2 L/D | Max Nguyen/email/initials/city/mood khác Minh Anh/ảnh/mẫu; Saved=3, Reviews=0 thay 14/5; không banner trong capture | `stitch-design.md` §0.1: chỉ dữ liệu thật; `/me`, full saved/review arrays; banner ẩn khi không có room tương lai hợp lệ. Không dựng sample hoặc suy count từ trang đầu. Owner **2026-11-08** [handoff build §1](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/codex-g11-build.md:4) yêu cầu nearest upcoming từ `/rooms` |
| E03 | 11.3 L/D; subtitle Defaults ở 11.2 | Một picker tỉnh/phường thay GPS + ba vùng ghim; tier chưa đặt/1,5 triệu/custom và nhãn theo model; mood taxonomy thật, count không cố định 3 | Owner **2026-11-08**, [comment §2](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834); §0.1 theo dữ liệu BE. Không đổi upper-bound thành schema range/unlimited, không đưa các chip mẫu thiếu taxonomy vào app |
| E04 | 11.4 L/D | Tile/nhãn minh hoạ thay ảnh quán Mơ, địa chỉ/giờ/trending/rating mẫu; caption không tương tác; tab Saved thay Bản đồ | Owner **2026-11-08**, [comment §2](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834): sample card không tương tác; §0.1: không dữ liệu thật thì không dựng facts. Bốn tab giữ navigation thật theo phạm vi UI-only trong #529/handoff; không thêm route Bản đồ |
| E05 | 11.2/11.5 L/D (11.1 chưa đo) | Không Help/FAQ/góp ý/báo lỗi/About/policy/“Thiết kế với đam mê”; không intro/cam kết riêng tư chưa có nguồn, không lời hứa camera/micro/storage; metadata không Saigon Edition/version mẫu | Owner **2026-11-08**, [comment §3](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834), [BE#810](https://github.com/namnh92/GoGo-BE/issues/810), [CMS#290](https://github.com/namnh92/GoGo-CMS/issues/290); §0.1 cho metadata build. Giữ disclosure consent SDK hiện hành |
| E06 | 11.2 L/D | Contributions thêm một row; Kèo mở upcoming dù không tổng; logout secondary + confirmation | [#529](https://github.com/namnh92/GoGo-MobileApp/issues/529) yêu cầu giữ Contributions, UI-only; [handoff owner 2026-11-08 §4/Keep](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/codex-g11-build.md:8) giữ quyền guest và session behavior. Không tự bỏ các route được owner giữ để khớp ảnh; GoGo AI được tách riêng ở U02, không suy thành ngoại lệ visual |
| E07 | Tất cả Dark; 11.4 swatch L/D | Không có Stitch Dark riêng; green/blue/purple dùng accent tokens đã hiệu chỉnh contrast, không lấy raw hex của sample HTML; safe area/status bar khác trang HTML | Owner **2026-11-07** tại [#529](https://github.com/namnh92/GoGo-MobileApp/issues/529): Dark theo tokens; màu theo semantic tokens (`design-system.md`). Quyết định contrast **2026-09-24** ghi ở `src/shared/ui/tokens.ts` phần `accents`; safe area/status bar là chrome nền tảng, không phải dữ liệu mock |
| E08 | 11.5 L/D | Account push switch và OS status tách facts; location có hướng dẫn/Settings/manual-area; iOS tracking mở OS Settings, Android switch, unavailable/error giữ nguyên; không “Đã đồng bộ” tổng | #529 UI-only, [handoff owner 2026-11-08 Keep](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/codex-g11-build.md:8), #525/#526; §0.1: không có fact sync tổng thì ẩn, không lấy account preference thay quyền OS; privacy promises theo E05 |

### Sai lệch chưa có ngoại lệ được duyệt / phần chưa thể kết luận

- **U01 — nút `…` trên 11.3–11.5 vẫn vắng:** HTML Stitch không định nghĩa hành động, không có destination/API tương ứng. Comment owner #529 không duyệt riêng việc bỏ nút này. Theo `stitch-design.md` §0, đã liệt kê để owner quyết; **không coi “nút chưa có chức năng” là ngoại lệ đã duyệt**, không tự invent menu hoặc nút chết. Đã hỏi owner trong lượt sửa này; chưa có câu trả lời tại thời điểm ghi báo cáo.
- **U02 — GoGo AI entry/FAB ở Profile không có trong Stitch:** giữ behavior theo phạm vi UI-only và feature gate hiện hành, không thay Help/CMS. Không tìm thấy quyết định riêng miễn visual parity cho phần này trong #529; cần owner xác nhận giữ hay thu gọn cách hiển thị. Không gộp vào E05/E06 như một ngoại lệ đã được duyệt.
- Header avatar → bell có căn cứ owner trong #529. Những chỗ giữ title/intro theo chức năng thật không được dùng để suy ra quyền bỏ `…`.
- 11.1 thiếu cả hai capture; native phần dưới fold và toàn bộ dirty patch chưa đo. V09 có regression proof cho trạng thái avatar loading nhưng capture Dark cụ thể vẫn cần đo lại. **F-01 chưa đủ điều kiện đóng toàn bộ native acceptance** chỉ từ ảnh cũ và tests.

## Sai khác có chủ đích / quyết định owner

1. **2026-11-08 — #529 / [GoGo-BE#809](https://github.com/namnh92/GoGo-BE/issues/809):** ẩn tổng Kèo, unread count, uy tín/cấp/check hồ sơ. Không lấy số trang đầu làm tổng, không dấu gạch hay số 0 giả. Kèo vẫn là lối mở Sắp tới, không có số. Chuông G11 không hiện dot hay đọc số unread; các header ngoài G11 giữ behavior hiện có.
2. **2026-11-08 — #529:** tách Defaults/Theme khỏi Account được owner chấp thuận. Giữ các route Account, Permissions, Saved, Reviews, Contributions và hành vi mở Kèo hiện có.
3. **2026-11-08 — #529 / [#524](https://github.com/namnh92/GoGo-MobileApp/issues/524):** chỉ một `homeAdministrativeArea`, dùng administrative picker hiện có; không GPS mặc định, không ba khu vực ghim; không ghi đè current area toàn app. Giữ legacy area đã có cho đến khi người dùng thay/xoá.
4. **2026-11-08 — #529:** giữ toàn bộ budget tiers hiện hành, trạng thái chưa đặt và giá trị custom từ BE. Không diễn giải null thành “không giới hạn”, không chuyển upper bound thành schema range. Mood giữ stable keys, tối đa 5 như trước.
5. **2026-11-08 — #529:** preview là minh hoạ được ghi rõ, không tương tác. Không dùng tên quán/giờ/Google rating/ảnh từ mẫu như dữ liệu thật. Dùng tile minh hoạ, nút và tab mô phỏng bằng View; tab mẫu khớp bốn tab thật, không thêm Bản đồ. Swatch chỉ đổi preview; lưu thất bại không báo thành công hoặc đổi màu toàn app.
6. **2026-11-08 — #529 / [GoGo-BE#810](https://github.com/namnh92/GoGo-BE/issues/810), [GoGo-CMS#290](https://github.com/namnh92/GoGo-CMS/issues/290):** không thêm FAQ, feedback, báo lỗi, About, policy links hoặc cam kết riêng tư chưa có nguồn CMS. “Đã đồng bộ” không có fact tổng nên ẩn theo §0.1; lời hứa camera/micro/storage chờ nội dung CMS. Nút `…` là U01 chưa có quyết định riêng, không phải ngoại lệ đã duyệt. Metadata phiên bản lấy từ build; không dùng Saigon Edition/version mẫu. Giữ disclosure SDK hiện có cần cho consent thực tế; không thay bằng cam kết trái dữ liệu SDK. GoGo AI là entry riêng hiện có, không giả làm FAQ/góp ý CMS; visual exception vẫn chưa được duyệt riêng (U02).
7. **2026-11-08 — #529 / [#525](https://github.com/namnh92/GoGo-MobileApp/issues/525), [#526](https://github.com/namnh92/GoGo-MobileApp/issues/526):** không đổi pipeline account switch/logout, push confirmation, thu hồi session hoặc cache purge; chỉ thêm xác nhận secondary. Dialog chưa xác nhận không được mang sang actor khác.
8. **2026-11-07 — #529:** Dark dùng cùng layout/nội dung, tokens theo mode. Shared Sheet/ResultSheet giữ animation/reduced motion hiện có; không thay primitives.

## Kết quả chạy bản sửa F-01

Kết quả của lượt hiện tại được ghi dưới đây; các gate cũ không được gán cho dirty patch.

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS, exit 0; [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/typecheck.log) |
| `pnpm lint` | PASS, exit 0; 0 errors / 0 warnings; [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/lint.log) |
| `pnpm test` | FAIL, exit 1: 134 files pass / 1 fail / 1 skipped; 1.573 tests pass / 3 fail / 39 skipped; [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/test.log) |
| `pnpm test:ui --runInBand` | PASS, exit 0: 194 suites / 2.334 tests; [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/test-ui.log) |
| Targeted sau chỉnh cuối (type/copy, chip pressed, save capsule) | PASS, exit 0: 7 suites / 81 tests; [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/ui-last.log) |
| i18n + avatar loading sau chỉnh cuối | PASS, exit 0: 2 suites / 46 tests; [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/ui-supplemental.log) |
| Avatar loading FAIL-before | 1 failed / 4 passed, [log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/f01-fix/avatar-before.log); assertion initials phải còn khi ảnh chưa load |
| `git diff --check` | PASS, exit 0 |

Ba failure đều ở file không đổi `src/shared/config/__tests__/distribute-wrapper.test.ts`: `refuses while the owner is alive`, `refuses recovery while a recorded build process group is still alive`, `keeps the lock and run files when a recorded build group is still alive after the child exits`. Đã chạy trực tiếp `/bin/ps -o lstart= -p $$`: `operation not permitted`. Không claim toàn bộ bốn gate xanh. Full UI suite được bổ sung targeted rerun sau các refinements cuối; không có source edit sau targeted run.

Giới hạn host: CoreSimulatorService và Computer Use Simulator không truy cập được; `ps` bị sandbox chặn. Không sửa/skip các test distribution-wrapper để làm xanh. Không claim native PASS-after, đủ 5/5 hay DEV acceptance. Không install, commit hoặc push.

## Theo dõi / rollback

- Giữ events `profile_defaults_saved`, `theme_accent_changed`, `auth_signed_out`, `auth_sign_out_failed`; không gửi nội dung hồ sơ trong event mới. Thêm screen templates cho hai route mới.
- Không dependency/migration/API mới. Rollback bản sửa F-01 bằng bỏ đúng dirty patch được lưu trong evidence; HEAD vẫn `3c9c428`. Bản sửa này chưa commit và không tác động remote.
