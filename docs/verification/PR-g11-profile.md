# G11 — Hồ sơ & cài đặt · PR #530

## Cập nhật theo owner 2026-11-08 / #529 — bỏ entry AI trùng lặp

Patch local trên HEAD `e6d1e73` cho PR #530: bỏ section “Trợ giúp” cùng row “GoGo AI” khỏi Profile theo approved deviation U02; giữ FAB “Hỏi GoGo AI” trên tab Profile và feature gate hiện tại. Xóa component/style riêng và hai key i18n không còn dùng (`profile.help`, `assistant.helpRow.body`) ở vi/en. UI test kiểm tra section/row vắng mặt khi gate bật hoặc tắt; bộ `assistant-fab.spec.tsx` tiếp tục kiểm tra FAB trên Profile và ẩn ở các subpages.

Chưa chụp native lại cho patch này; ảnh bên dưới là evidence lịch sử theo SHA đã ghi, không chứng minh bố cục mới sau khi bỏ section. Không commit/push.

Gate chạy trên patch local (HEAD nền `e6d1e73`, 2026-11-08):

| Lệnh | Kết quả patch local | Log |
|---|---|---|
| `pnpm typecheck` | PASS, exit 0 | [typecheck](/tmp/pr530-typecheck.log) |
| `pnpm lint` | PASS, exit 0; không errors/warnings | [lint](/tmp/pr530-lint.log) |
| `pnpm test` | FAIL, exit 1; 134 files pass, 1 fail, 1 skip; 1.573 tests pass, 3 fail, 39 skip | [unit](/tmp/pr530-test.log) |
| `pnpm test:ui --runInBand` | PASS, exit 0; 195 suites / 2.362 tests, gồm contextual-entry và FAB Profile | [UI](/tmp/pr530-test-ui.log) |
| `git diff --check` | PASS, exit 0 | Kiểm tra local |

Ba lỗi unit ở `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, `:258`, ngoài phạm vi source sửa: kiểm tra lock/process đang chạy. Sandbox từ chối `ps` (`operation not permitted`); case đầu không có stdout để `.trim()`, hai case còn lại mong exit khác 0 nhưng nhận 0 khi kiểm tra process group sống. Không sửa/skip các test này để làm xanh gate. Không claim unit suite pass.

## F-01 P1 — CLOSED · evidence tại `fa49468`

Cập nhật **DOC ONLY, 2026-11-08, Sol 6.1 medium**, HEAD `fa49468`. Claude đã chụp lại tám PNG Light/Dark sau sửa `onAccent`; source/build identity theo owner, không suy SHA build từ bytes ảnh. Đã xem trực tiếp cả tám ảnh: Profile có avatar chữ **M** và icon/nhãn FAB; Defaults Save enabled có icon save và nhãn trắng; Theme có selected check, nhãn/mũi tên primary preview CTA; Permissions có chữ/icon/control rõ ở cả hai mode. **Đóng F-01 về foreground trong các vùng và trạng thái đã chụp.** Không dùng ảnh `d899e47` để chứng minh fix mới.

Các vùng Profile top, Theme top, Permissions top và Defaults Save enabled bên dưới dùng capture **`fa49468`**. Các vùng khác giữ **`d899e47`**, là evidence lịch sử về layout/nội dung, không phải fresh capture tại HEAD. Phạm vi sửa `fa49468` là accent-fill foreground tokens (`accent.onAccent`) và cách áp dụng chúng; đối chiếu source còn có primary area/discovery fill theo accent đang chọn, swatches theo mode và đồng nhất icon/label của chip với foreground của từng appearance. Không có thay đổi cấu trúc G11 hay business flow trong delta. Vì vậy giữ evidence cũ cho các vùng không chụp lại, với giới hạn provenance này.

### Files changed `d899e47..fa49468`

Kết quả `git diff --stat d899e47..fa49468` (trước lượt DOC ONLY này):

```text
 docs/verification/PR-g11-profile.md                | 248 ++++++++-------------
 src/features/account/theme-accent.view.tsx         |   6 +-
 src/features/gogo-room/room-manage.view.tsx        |   2 +-
 src/features/home/home.view.tsx                    |   4 +-
 src/features/onboarding/onboarding-visual.view.tsx |   2 +-
 src/features/review/shared-result.view.tsx         |   6 +-
 src/shared/ui/__tests__/accent-foreground.spec.tsx | 114 +++++++++-
 src/shared/ui/button.style.tsx                     |   4 +-
 src/shared/ui/button.view.tsx                      |   2 +-
 src/shared/ui/icons.tsx                            |   2 +-
 src/shared/ui/primitives.tsx                       |   7 +-
 src/shared/ui/tokens.ts                            |  22 +-
 12 files changed, 226 insertions(+), 193 deletions(-)
```

### Capture manifest `fa49468`

SHA-256 tính từ bytes local trong lượt này; identity build `fa49468` do owner/Claude cung cấp. Tám ảnh đều native `1206×2622 px` (`402×874 pt @3x`).

| Capture | Kích thước | SHA-256 |
|---|---|---|
| [profile-dark-top.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/profile-dark-top.png) | 1206×2622 | `04f9146319d0f6da86b38d392372c0a8bb1d00684493b608f3e191b57d736b31` |
| [profile-light-top.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/profile-light-top.png) | 1206×2622 | `57cf02eea355e08f312de092e7e657034493fb19e9106e321486e2505b23ef31` |
| [settings-defaults-dark-save-enabled.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-defaults-dark-save-enabled.png) | 1206×2622 | `db6f1f3e56d8b8093a6a39f30dec8b233534ff72d8672757a180ddc623874565` |
| [settings-defaults-light-save-enabled.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-defaults-light-save-enabled.png) | 1206×2622 | `0ae8108ad28c8ba0da22adb48b800aecfcded89d2dda46c2c0e9bcb335b47de4` |
| [settings-notifications-dark-top.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-notifications-dark-top.png) | 1206×2622 | `b2d5ca30327e92c0142a1cd6dfd8ebd588a50de1db7bc5c4fa86f3f35779de91` |
| [settings-notifications-light-top.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-notifications-light-top.png) | 1206×2622 | `5e5e58c10182d421b1b1443d11150a7cef4eb3501a922c7f8f9ec91d7876f68b` |
| [settings-theme-dark-top.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-theme-dark-top.png) | 1206×2622 | `8f47b7464ab23769e08047ab3ebccf5b28b31ffd303c8ffd644223fc796a625b` |
| [settings-theme-light-top.png](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-theme-light-top.png) | 1206×2622 | `d49417a8e778f08a4b61ab39da159ddcc7d08f9a7990f6b4f0ab1ca5be104514` |

Defaults Save enabled chỉ chứng minh foreground của CTA: frame này che một phần guidance, nên coverage guidance/cuối trang vẫn dựa trên series `d899e47`. Theme top không chứa Apply/helper phía dưới; phần đó giữ ảnh lịch sử. Không claim save persistence, mọi accent/state hoặc native theme switching chỉ từ các ảnh tĩnh này. Blocker capture của lượt patch local trước đây đã được thay bằng bộ recapture do Claude cung cấp; không kết luận nguyên nhân cache/Metro/build của F-01 cũ.

## Phạm vi và nguồn evidence

- Ngày **2026-11-08** (Asia/Ho_Chi_Minh), role **Sol 6.1 medium**, worktree `mobile-g11`, HEAD **`fa49468`**. Lượt này chỉ sửa tài liệu, chạy `pnpm lint`, không sửa source/install/commit/push. Bộ mới `fa49468` dùng cho các vùng ghi rõ bên dưới; source/build của bộ cũ là **`d899e476685cac48b78bee3bde6fefe29392bf27`**. Delta source giữa hai revision được liệt kê ở đầu báo cáo.
- Claude cung cấp PNG tại `d899e47/`: **32 ảnh gốc + 20 ảnh bổ sung đã kiểm tra** (8 `-top`, 10 Defaults `-s1..s5`, 2 Defaults `-save-enabled`). Các file `-s0`/`-s6` không nằm trong tập 52 ảnh được viện dẫn. SHA build theo owner, không suy từ bytes ảnh. Native `1206×2622 px` = `402×874 pt @3x`.
- Nguồn authoritative: PNG **và HTML** local `dev/handoffs/stitch-g11/11.1–11.5`; lượt đối chiếu lịch sử đã đọc markup và xem ảnh 11.2–11.5. Screen IDs đã ghi nhận từ Stitch MCP project `17315762413421369447` ở lượt trước: 11.1 `6448661778109417257`, 11.2 `9700245316043548900`, 11.3 `433670407807033328`, 11.4 `6461691912362925009`, 11.5 **`6458166590678622329`**. Lượt đối chiếu lịch sử dùng đúng handoff local, không thay bằng màn trùng tên và không claim đã refresh inventory remote.
- [Gallery bổ sung: Stitch cạnh capture Light/Dark](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/comparison-supplement.html), nhúng nguyên bytes; [manifest bổ sung: đường dẫn/kích thước/SHA-256](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/image-sources-supplement.json). Giữ [gallery 32 ảnh gốc](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/comparison.html) và [manifest gốc](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/image-sources.json) để truy nguyên. So thành phần, thứ tự, phân cấp chữ, geometry và màu semantic; giữ tỷ lệ ảnh, không claim pixel parity. Safe area/status bar là chrome nền tảng.
- Dark đối chiếu layout/nội dung với Stitch Light, màu theo tokens, ngoại lệ owner **2026-11-07 / #529**. Bộ local không có Stitch Dark riêng.

**4/5 screens compared**: 11.2–11.5 đã so các vùng được viện dẫn ở cả Light và Dark, gồm năm gap Astra nêu. **Guest 11.1 = owner simulator check (owner sim-check)**; bộ này chưa có capture guest, không tính vào 4 màn native đã so. Không diễn giải thành 5/5 native hoặc full-state visual acceptance.

## Screen × theme × region

Tên file không thay cho nội dung ảnh: `profile-light-0.png` gốc là **Trang Chủ**, tiếp tục EXCLUDED. Profile/Theme/Permissions `-top.png` mới đúng đầu trang. Riêng Defaults `-top.png` mới thực tế ở **cuối budget → moods → guidance**, không phải đầu trang; dùng `settings-defaults-{light,dark}-0.png` gốc cho intro/area picker/đầu budget. Series mới `-s1..s5` nhìn thấy moods/guidance; một số frame lặp không làm tăng coverage.

`COMPARED` chỉ áp vùng và trạng thái thấy trong ảnh. Các khác biệt theo owner được dẫn ID bên dưới.

| Màn | Theme | Region / capture (`fa49468` khi ghi top/Save enabled mới; còn lại `d899e47`) | Kết quả |
|---|---|---|---|
| 11.2 Cá nhân | Light | [top](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/profile-light-top.png); identity/avatar, city/mood chips, ba shortcuts, đầu settings (inbox/reviews/permissions/account/contributions). Vùng cuối tiếp nối trong [ảnh gốc 1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-light-1.png) | COMPARED; E01/E02/E03/E05/E06/U02. Banner upcoming không xuất hiện trong tài khoản capture; không đo trạng thái có banner |
| 11.2 Cá nhân | Dark | [top](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/profile-dark-top.png); identity/avatar, city/mood chips, ba shortcuts, đầu settings (inbox/reviews/permissions/account/contributions). Vùng cuối tiếp nối trong [ảnh gốc 1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-dark-1.png) | COMPARED; E01/E02/E03/E05/E06/U02/E07. Banner upcoming không xuất hiện trong tài khoản capture; không đo trạng thái có banner |
| 11.3 Mặc định | Light | [đầu trang gốc](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-0.png) + [top (thực tế vùng dưới)](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-top.png) + [s1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-s1.png) · [s2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-s2.png) · [s3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-s3.png) · [s4](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-s4.png) · [s5](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-s5.png); cuối budget, heading/count, toàn bộ mood chips và guidance | COMPARED; E03/U01/H01. Đã chọn 3, ba chip có check; guidance nằm trên Save cố định, chữ/chip không bị che ở cuối trang |
| 11.3 Save enabled | Light | [Save enabled sau chọn budget (theo Claude)](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-defaults-light-save-enabled.png) | COMPARED; nền accent, icon save và chữ “Lưu thiết lập mặc định” đều rõ. F-01 CLOSED cho foreground tại `fa49468`; không chứng minh request/persistence thành công |
| 11.3 Mặc định | Dark | [đầu trang gốc](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-0.png) + [top (thực tế vùng dưới)](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-top.png) + [s1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-s1.png) · [s2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-s2.png) · [s3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-s3.png) · [s4](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-s4.png) · [s5](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-s5.png); cuối budget, heading/count, toàn bộ mood chips và guidance | COMPARED; E03/U01/H01/E07. Đã chọn 3, ba chip có check; guidance nằm trên Save cố định, chữ/chip không bị che ở cuối trang |
| 11.3 Save enabled | Dark | [Save enabled sau chọn budget (theo Claude)](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-defaults-dark-save-enabled.png) | COMPARED; nền accent, icon save và chữ “Lưu thiết lập mặc định” đều rõ. F-01 CLOSED cho foreground tại `fa49468`; không chứng minh request/persistence thành công |
| 11.4 Màu | Light | [top](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-theme-light-top.png); pill/intro/title, palette heading/current accent, swatches → preview/sample tabs. [ảnh gốc 0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-light-0.png) có Apply/helper phía dưới | COMPARED; E04/E07/U01/H01. Đủ vùng intro/palette trước đây thiếu; check/CTA foreground thấy rõ |
| 11.4 Màu | Dark | [top](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-theme-dark-top.png); pill/intro/title, palette heading/current accent, swatches → preview/sample tabs. [ảnh gốc 0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-dark-0.png) có Apply/helper phía dưới | COMPARED; E04/E07/U01/H01. Đủ vùng intro/palette trước đây thiếu; check/CTA foreground thấy rõ |
| 11.5 Quyền | Light | [top](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-notifications-light-top.png); intro → device heading, account push switch/OS fact, location controls → đầu tracking. [ảnh gốc 0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-light-0.png) có tracking/system CTA/version | COMPARED; E05/E08/U01/H01. Đủ vùng intro/device/notification trước đây thiếu |
| 11.5 Quyền | Dark | [top](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/settings-notifications-dark-top.png); intro → device heading, account push switch/OS fact, location controls → đầu tracking. [ảnh gốc 0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-dark-0.png) có tracking/system CTA/version | COMPARED; E05/E08/U01/H01/E07. Đủ vùng intro/device/notification trước đây thiếu |
| 11.1 Khách | Light/Dark | Không có capture guest trong tập này | Owner sim-check; NOT MEASURED native; UI-test covered, không tính native parity |

## Năm gap Astra nêu — đối chiếu Stitch và evidence theo vùng

| Gap | Quan sát Light/Dark bổ sung | Kết luận |
|---|---|---|
| Profile top | Card identity trước ba shortcut; avatar chữ M, Max Nguyen/email/city thật, ba mood chips; Saved 3, Kèo không tổng, Reviews 0. Inbox/reviews/permissions/account đúng thứ tự; thêm Contributions. Không badge uy tín/check/cấp/unread, không banner mẫu | COMPARED; E01/E02/E06. Avatar Dark và chữ/chips đều thấy rõ. Không suy rằng trạng thái có ảnh avatar hoặc có upcoming banner đã được chụp |
| Defaults moods/guidance | Sau budget là heading “Sở thích ưu tiên”, “Đã chọn 3”, card chips wrap nguyên chip; check ở Thư giãn/Lãng mạn/Sôi động. Panel tím có sparkle và lời nhắc tinh chỉnh tiêu chí trước gửi lời mời, đúng vai trò/thứ tự Stitch | COMPARED; E03 cho taxonomy thật, tối đa 5 và copy phù hợp. Guidance không bị Save che ở cuối trang; Dark giữ đủ chữ/icon. Không dùng các frame lặp làm bằng chứng swipe thêm |
| Theme top | Pill “Cá nhân hóa giao diện”, title “Màu sắc cảm xúc”, intro, “Bảng màu điểm nhấn”/“Cam GoGo”, bốn swatches và selected check trước live preview, cùng cấu trúc Stitch | COMPARED; E04/E07/H01/U01. Bản native ở 402 pt nên ngắt dòng có thể khác ảnh Stitch 390 pt; không kéo giãn để suy khớp pixel |
| Permissions top | Intro card có shield, “Quyền và dữ liệu trên thiết bị”; tiếp device heading, account push switch + OS fact, location status/disclosure/Settings/manual-area. Không badge “Đã đồng bộ” mẫu | COMPARED; E05/E08 cho copy có nguồn, tách account/OS/device facts và control thực tế. Card/section hierarchy giữ theo Stitch; không dùng trạng thái OS chụp được để claim mọi permission state |
| Defaults enabled Save | Cả hai ảnh mới có CTA accent enabled, icon save và toàn bộ nhãn trắng rõ, so với CTA cố định của Stitch và disabled state trong series | F-01 CLOSED cho foreground qua capture `fa49468`; không claim đã bấm/lưu thành công |

Năm gap đã có evidence theo vùng: top/Save enabled tại `fa49468`, moods/guidance và các vùng còn lại tại `d899e47`. F-01 đóng trong phạm vi foreground đã chụp; lượt này không thay source. Sai tên Defaults `-top` là lưu ý provenance, không phải bằng chứng lỗi cuộn runtime.

## Deviations và ngoại lệ đã duyệt

Các quyết định giữ nguyên từ [owner 2026-11-08 / #529](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834), [handoff owner](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/codex-g11-build.md:3) và quyết định U01/U02 trong chỉ thị owner ngày **2026-11-08 / #529**. Không biến vùng chưa đo thành approved deviation.

| ID | Screen/theme/region | Khác Stitch còn áp dụng | Căn cứ chấp thuận |
|---|---|---|---|
| E01 | 11.2 L/D, identity/shortcuts/header | Không check/uy tín/cấp, tổng Kèo hay unread dot/count | Owner 2026-11-08, #529 §1; [BE#809](https://github.com/namnh92/GoGo-BE/issues/809): thiếu facts/API thì ẩn, không giả tổng |
| E02 | 11.2 L/D, identity/count/banner | Dữ liệu tài khoản thật thay Minh Anh/14/8/5/mẫu cuối tuần; banner chỉ có room tương lai hợp lệ | Owner 2026-11-08, handoff §1; `stitch-design.md` §0.1: không lấy sample làm dữ liệu thật |
| E03 | 11.3 L/D và subtitle Defaults ở Profile | Một administrative picker tỉnh/phường thay GPS/ba vùng ghim; giữ chưa đặt, tất cả budget tiers/custom; mood taxonomy thật và count động, tối đa 5 | Owner 2026-11-08, #529 §2; [#524](https://github.com/namnh92/GoGo-MobileApp/issues/524). Không đổi current area toàn app hay diễn giải null thành unlimited. Moods/count/guidance đã đối chiếu trong bộ bổ sung |
| E04 | 11.4 L/D, preview/helper | Tile minh hoạ thay ảnh/quán/địa chỉ/giờ/rating mẫu; nhãn không tương tác; sample tabs theo bốn tab thật (Đã lưu thay Bản đồ); copy mô tả theme thật | Owner 2026-11-08, #529 §2 và handoff: sample card không tương tác, chọn chỉ preview, Apply mới lưu. Không thêm dữ liệu quán giả |
| E05 | 11.2/11.5 L/D, hỗ trợ/privacy/footer | Ẩn FAQ/góp ý/báo lỗi/About/policy/branding và cam kết chưa có nguồn; metadata `0.1.0` từ build thay Saigon Edition mẫu | Owner 2026-11-08, #529 §3; [BE#810](https://github.com/namnh92/GoGo-BE/issues/810), [CMS#290](https://github.com/namnh92/GoGo-CMS/issues/290); giữ disclosure consent SDK thật |
| E06 | 11.2 L/D, settings/logout | Thêm Contributions; Kèo mở upcoming dù không tổng; logout secondary có confirmation | Owner 2026-11-08, #529 / handoff Keep; giữ route/quyền và hành vi session của [#525](https://github.com/namnh92/GoGo-MobileApp/issues/525), [#526](https://github.com/namnh92/GoGo-MobileApp/issues/526) |
| E07 | Mọi Dark; 11.4 swatches L/D | Dark dùng semantic tokens; green/blue/purple theo accent tokens đã chỉnh contrast, không raw hex HTML | Owner 2026-11-07 / #529: Dark theo tokens; `design-system.md`, quyết định contrast 2026-09-24 trong `src/shared/ui/tokens.ts`. Không miễn lỗi mất foreground |
| E08 | 11.5 L/D, device/tracking/location | Account push/OS/device facts tách riêng; location có Settings/manual-area; iOS tracking mở Settings thay switch; giữ unavailable/retry; không nhãn sync tổng | Owner 2026-11-08, #529 UI-only / handoff Keep, #525/#526; §0.1 không bịa trạng thái OS/sync; privacy copy theo E05 |
| H01 | Header 11.3–11.5 L/D | Bell thay avatar | Owner 2026-11-08, handoff Keep; không unread dot/count theo E01 |
| U01 | Header 11.3–11.5 L/D | Bỏ nút `…` không có chức năng được định nghĩa | Owner 2026-11-08 / #529, chỉ thị áp dụng PR #530: giữ header không menu chết |
| U02 | 11.2 L/D và ba subpages | Chỉ giữ FAB “Hỏi GoGo AI” trên tab Profile theo feature gate; bỏ section “Trợ giúp” và row “GoGo AI” trùng lặp; ẩn FAB trên Defaults/Theme/Permissions (kể cả alias Location) | Owner 2026-11-08 / #529, chỉ thị áp dụng PR #530; owner yêu cầu bỏ entry trùng FAB. AI là feature hiện có, không thay FAQ/góp ý CMS |

Các xác nhận từ bộ gốc vẫn giữ nguyên: system gear ở 11.5 Light/Dark đúng glyph `settings` của Stitch; Theme helper ở 11.4 Light/Dark căn giữa theo `text-center`; selected swatch check, sample CTA/mũi tên, Apply chữ/icon, system CTA chữ/icon và mặt AI FAB đều có foreground. Apply/helper và system CTA/footer ngoài frame mới vẫn là quan sát lịch sử tại `d899e47`; F-01 đóng dựa trên các foreground đã chụp lại tại `fa49468`, không mở rộng thành fresh acceptance cho những vùng ngoài frame.

## Kiểm chứng tự động và provenance

| Lệnh | Revision / kết quả | Log |
|---|---|---|
| `pnpm lint` | **Chạy lại DOC ONLY tại HEAD `fa49468`: PASS, exit 0; không errors/warnings** | [lint-doc-update.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/fa49468/lint-doc-update.log) |
| `pnpm lint` | **Lịch sử tại HEAD `7aa3350`: PASS, exit 0; không errors/warnings** | [lint-7aa3350-evidence-update.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/lint-7aa3350-evidence-update.log) |
| `git diff --check` | Chạy sau cập nhật tài liệu: PASS, exit 0 | Kiểm tra local |
| `pnpm typecheck` | **Kết quả lượt trước tại `d899e47`**, PASS, exit 0; không chạy lại lượt bổ sung | [typecheck.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/typecheck.log) |
| `pnpm test:ui --runInBand` | **Kết quả lượt trước tại `d899e47`**, PASS, exit 0; **195 suites / 2.346 tests**. Không chạy lại trong lượt DOC ONLY; source đã đổi từ `d899e47`, đây chỉ là kết quả lịch sử | [test-ui.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/test-ui.log) |

Guest 11.1 được phủ bởi [`profile-keo-count.spec.tsx:40`](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-g11/src/features/__tests__/profile-keo-count.spec.tsx:40): guest có Đăng nhập/Đăng ký, không lộ profile cache, mở được Màu, Saved bị khoá có lý do và CTA sign-in. Parametrized test tại dòng 20 phủ user/guest/anonymous Kèo không hiện tổng không được hỗ trợ và mở upcoming. Đây là test render/hành vi, không chứng minh native Light/Dark parity; native guest là **owner sim-check**.

UI suite lượt trước còn phủ defaults payload/draft/error, theme preview/Apply/storage, permission routes, assistant FAB route visibility và logout/account-switch. Không gán các log typecheck/UI cũ thành lần chạy mới tại `fa49468`. Lượt DOC ONLY này chỉ chạy lại lint; không chạy `pnpm test`, typecheck hay UI suite. Source giữ nguyên HEAD `fa49468`.

## Acceptance còn lại

**F-01 P1 CLOSED** về foreground qua tám capture Light/Dark tại `fa49468`. Coverage tổng hợp là **4/5 compared + guest owner sim-check**, dùng evidence theo vùng từ `fa49468` và `d899e47` như bảng trên; không phải toàn bộ màn đã chụp lại tại HEAD. Chưa có native guest, trạng thái có upcoming banner/ảnh avatar, save persistence hoặc mọi loading/error/permission state trong bộ capture; không claim full-state acceptance. Không claim pixel parity, SE/chữ lớn/screen-reader/contrast đo trên thiết bị hoặc DEV acceptance. Không commit/push.
