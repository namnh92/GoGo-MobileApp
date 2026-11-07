# G11 — Hồ sơ & cài đặt · PR #530

## Phạm vi và nguồn evidence

- Ngày **2026-11-08** (Asia/Ho_Chi_Minh), role theo owner: **Sol 6.1 medium**. Worktree `mobile-g11`, branch `feature/GOGO-529-redesign-g11-profile`, HEAD **`d899e476685cac48b78bee3bde6fefe29392bf27`**. Source sạch trước/sau kiểm chứng; lượt này chỉ sửa tài liệu. Không install/commit/push.
- Toàn bộ evidence native trong tài liệu là **32 PNG tại `d899e47/`** do Claude cung cấp. SHA build theo owner, không suy từ bytes ảnh. Native `1206×2622 px` = `402×874 pt @3x`. Không dùng lại capture hoặc kết quả gate cũ.
- Nguồn authoritative: PNG **và HTML** local `dev/handoffs/stitch-g11/11.1–11.5`; đã đọc nội dung/markup và ảnh 11.2–11.5. Stitch MCP `list_screens` xác nhận các screen trong project `17315762413421369447`: 11.1 `6448661778109417257`, 11.2 `9700245316043548900`, 11.3 `433670407807033328`, 11.4 `6461691912362925009`, 11.5 **`6458166590678622329`**. Dùng đúng 11.5 trong handoff, không thay bằng màn trùng tên.
- [Gallery Stitch cạnh từng capture Light/Dark](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/comparison.html), nhúng nguyên bytes; [manifest đường dẫn/kích thước/SHA-256](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/image-sources.json). So thành phần, thứ tự, typography, geometry và màu semantic; không kéo giãn để claim pixel parity. Safe area/status bar là chrome nền tảng.
- Dark đối chiếu layout/nội dung với Stitch Light, màu theo tokens, ngoại lệ owner **2026-11-07 / #529**. Bộ local không có Stitch Dark riêng.

**4/5 screens compared, có giới hạn vùng nhìn thấy**: 11.2–11.5 có ít nhất một vùng native ở cả Light và Dark. Đây không phải 4/5 full-page PASS. **Guest 11.1 = owner simulator check**, chưa có capture trong bộ này; UI-test covered, không tính vào số màn native đã so.

## Screen × theme × region

**Phát hiện về capture:** nhãn `0 = top`, `1..3 = swipes up` không khớp nội dung PNG. `profile-light-0.png` là **Trang Chủ**, không phải Profile. Các frame còn lại lặp cùng vùng cuộn: không có bằng chứng Defaults moods/guidance. Không dùng tên file/số lần swipe để suy coverage.

`COMPARED` chỉ áp vùng ghi rõ. `NOT MEASURED` là thiếu evidence, không phải ngoại lệ owner hay lỗi source đã xác lập.

| Màn | Theme | Region thực tế | Capture tại d899e47 | Kết quả / ngoại lệ |
|---|---|---|---|---|
| 11.2 Cá nhân | Light | Trang Chủ, ngoài scope Profile | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-light-0.png) | EXCLUDED: sai màn; không chứng minh identity/shortcuts/banner |
| 11.2 Cá nhân | Light | Cuối settings → Contributions → Defaults/Theme → GoGo AI → logout/version/dock | [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-light-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-light-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-light-3.png) | COMPARED; E03/E05/E06/U02. Thiếu identity, mood chips, shortcuts, banner, inbox/reviews |
| 11.2 Cá nhân | Dark | Cùng vùng cuối Profile như Light 1–3 | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-dark-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-dark-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-dark-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/profile-dark-3.png) | COMPARED; cùng ngoại lệ Light + E07; mặt AI FAB trắng rõ. Identity/avatar/shortcuts/banner NOT MEASURED |
| 11.3 Mặc định | Light | Header/intro → area picker → phần đầu budget; Save cố định, disabled | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-light-3.png) | COMPARED; E03/U01/H01. Các frame không tới cuối budget/moods/guidance |
| 11.3 Mặc định | Dark | Cùng vùng đầu Defaults như Light | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-defaults-dark-3.png) | COMPARED; E03/E07/U01/H01. Save disabled có chữ/icon; enabled foreground NOT MEASURED |
| 11.4 Màu | Light | Header; phần swatch → preview → sample tabs → Apply/helper | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-light-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-light-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-light-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-light-3.png) | COMPARED; E04/E07/U01/H01. Thiếu intro/pill/title và heading palette ở đầu trang |
| 11.4 Màu | Dark | Cùng vùng cuộn Theme như Light | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-dark-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-dark-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-dark-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-theme-dark-3.png) | COMPARED; E04/E07/U01/H01. Check, sample CTA/mũi tên, Apply chữ/icon đều thấy; helper căn giữa |
| 11.5 Quyền | Light | Header; cuối Location → tracking → system card/CTA → version | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-light-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-light-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-light-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-light-3.png) | COMPARED; E05/E08/U01/H01. Thiếu intro và phần đầu device/notification controls |
| 11.5 Quyền | Dark | Cùng vùng cuối Permissions như Light | [0](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-dark-0.png) · [1](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-dark-1.png) · [2](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-dark-2.png) · [3](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/settings-notifications-dark-3.png) | COMPARED; E05/E07/E08/U01/H01. Gear và system CTA chữ/icon thấy rõ |
| 11.1 Khách | Light | Toàn màn | Không có trong bộ d899e47 | NOT MEASURED native; owner sim check; UI-test covered |
| 11.1 Khách | Dark | Toàn màn | Không có trong bộ d899e47 | NOT MEASURED native; owner sim check; UI-test covered |

| Region còn thiếu | Light | Dark | Cách đóng |
|---|---|---|---|
| 11.2 identity/avatar, city/mood chips, shortcuts, upcoming banner và đầu settings | NOT MEASURED | NOT MEASURED | Recapture đúng Profile từ đầu scroll, tiếp tới vùng đã có |
| 11.3 cuối budget, Sở thích ưu tiên/count/chips, panel guidance | NOT MEASURED | NOT MEASURED | Cuộn thật tới từng vùng; ảnh hiện tại cả 0–3 vẫn ở đầu |
| 11.4 intro/pill/title, heading palette/current accent | NOT MEASURED | NOT MEASURED | Reset scroll về đầu rồi chụp |
| 11.5 intro, đầu device/notification controls | NOT MEASURED | NOT MEASURED | Reset scroll về đầu rồi chụp |
| 11.1 guest | Owner sim check | Owner sim check | Owner kiểm tra signed-out/guest; bộ này không có native evidence |

## Deviations và ngoại lệ đã duyệt

Các quyết định giữ nguyên từ [owner 2026-11-08 / #529](https://github.com/namnh92/GoGo-MobileApp/issues/529#issuecomment-6710656834), [handoff owner](/Users/maxnguyen/MyWorks/GoGo/dev/handoffs/codex-g11-build.md:3) và quyết định U01/U02 trong chỉ thị owner ngày **2026-11-08 / #529**. Không biến vùng chưa đo thành approved deviation.

| ID | Screen/theme/region | Khác Stitch còn áp dụng | Căn cứ chấp thuận |
|---|---|---|---|
| E01 | 11.2 L/D, identity/shortcuts/header (các vùng đầu chưa đo) | Không check/uy tín/cấp, tổng Kèo hay unread dot/count | Owner 2026-11-08, #529 §1; [BE#809](https://github.com/namnh92/GoGo-BE/issues/809): thiếu facts/API thì ẩn, không giả tổng |
| E02 | 11.2 L/D, identity/count/banner chưa đo | Dữ liệu tài khoản thật thay Minh Anh/14/8/5/mẫu cuối tuần; banner chỉ có room tương lai hợp lệ | Owner 2026-11-08, handoff §1; `stitch-design.md` §0.1: không lấy sample làm dữ liệu thật |
| E03 | 11.3 L/D và subtitle Defaults ở Profile | Một administrative picker tỉnh/phường thay GPS/ba vùng ghim; giữ chưa đặt, tất cả budget tiers/custom; mood taxonomy thật và count động, tối đa 5 | Owner 2026-11-08, #529 §2; [#524](https://github.com/namnh92/GoGo-MobileApp/issues/524). Không đổi current area toàn app hay diễn giải null thành unlimited. Phần moods/guidance chưa đo |
| E04 | 11.4 L/D, preview/helper | Tile minh hoạ thay ảnh/quán/địa chỉ/giờ/rating mẫu; nhãn không tương tác; sample tabs theo bốn tab thật (Đã lưu thay Bản đồ); copy mô tả theme thật | Owner 2026-11-08, #529 §2 và handoff: sample card không tương tác, chọn chỉ preview, Apply mới lưu. Không thêm dữ liệu quán giả |
| E05 | 11.2/11.5 L/D, hỗ trợ/privacy/footer | Ẩn FAQ/góp ý/báo lỗi/About/policy/branding và cam kết chưa có nguồn; metadata `0.1.0` từ build thay Saigon Edition mẫu | Owner 2026-11-08, #529 §3; [BE#810](https://github.com/namnh92/GoGo-BE/issues/810), [CMS#290](https://github.com/namnh92/GoGo-CMS/issues/290); giữ disclosure consent SDK thật |
| E06 | 11.2 L/D, settings/logout | Thêm Contributions; Kèo mở upcoming dù không tổng; logout secondary có confirmation | Owner 2026-11-08, #529 / handoff Keep; giữ route/quyền và hành vi session của [#525](https://github.com/namnh92/GoGo-MobileApp/issues/525), [#526](https://github.com/namnh92/GoGo-MobileApp/issues/526) |
| E07 | Mọi Dark; 11.4 swatches L/D | Dark dùng semantic tokens; green/blue/purple theo accent tokens đã chỉnh contrast, không raw hex HTML | Owner 2026-11-07 / #529: Dark theo tokens; `design-system.md`, quyết định contrast 2026-09-24 trong `src/shared/ui/tokens.ts`. Không miễn lỗi mất foreground |
| E08 | 11.5 L/D, device/tracking/location | Account push/OS/device facts tách riêng; location có Settings/manual-area; iOS tracking mở Settings thay switch; giữ unavailable/retry; không nhãn sync tổng | Owner 2026-11-08, #529 UI-only / handoff Keep, #525/#526; §0.1 không bịa trạng thái OS/sync; privacy copy theo E05 |
| H01 | Header 11.3–11.5 L/D | Bell thay avatar | Owner 2026-11-08, handoff Keep; không unread dot/count theo E01 |
| U01 | Header 11.3–11.5 L/D | Bỏ nút `…` không có chức năng được định nghĩa | Owner 2026-11-08 / #529, chỉ thị áp dụng PR #530: giữ header không menu chết |
| U02 | 11.2 L/D và ba subpages | Giữ entry/FAB GoGo AI trên Profile theo feature gate; ẩn FAB trên Defaults/Theme/Permissions (kể cả alias Location) | Owner 2026-11-08 / #529, chỉ thị áp dụng PR #530; AI là feature hiện có, không thay FAQ/góp ý CMS |

## Xác nhận các điểm cần recapture

- **System gear:** thấy đúng gear trong 11.5 Light/Dark, các frame 0–3; tương ứng glyph `settings` của Stitch.
- **Theme helper:** căn giữa ở 11.4 Light/Dark, các frame 0–3; tương ứng `text-center` trong HTML Stitch.
- **Dark foreground:** thấy selected swatch check, sample CTA chữ/mũi tên, Apply chữ/icon, system CTA chữ/icon và mặt AI FAB. Không còn hiện tượng mất các foreground này trong vùng hiện có. Không suy từ đó rằng Defaults Save enabled hay avatar Dark đã đo.
- **Defaults moods/guidance:** vẫn **NOT MEASURED**. Không đóng bằng UI test hoặc bằng số thứ tự capture.
- **Không phát hiện visual defect mới trong vùng được cung cấp; không sửa source.** Sai màn/scroll coverage là thiếu evidence, chưa chứng minh lỗi cuộn runtime. Source `SettingsPage` có `ScrollView`; không đổi source bằng phỏng đoán từ các frame lặp.

## Kiểm chứng tự động tại d899e47

| Lệnh | Kết quả lượt này | Log |
|---|---|---|
| `pnpm typecheck` | PASS, exit 0 | [typecheck.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/typecheck.log) |
| `pnpm lint` | PASS, exit 0; không errors/warnings | [lint.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/lint.log) |
| `pnpm test:ui --runInBand` | PASS, exit 0; **195 suites / 2.346 tests** | [test-ui.log](/Users/maxnguyen/MyWorks/GoGo/dev/test-evidence/mobile-530-g11/d899e47/verification/test-ui.log) |
| `git diff --check` | PASS, exit 0 | Kiểm tra sau khi viết tài liệu |

Guest 11.1 được phủ bởi [`profile-keo-count.spec.tsx:40`](/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/mobile-g11/src/features/__tests__/profile-keo-count.spec.tsx:40): guest có Đăng nhập/Đăng ký, không lộ profile cache, mở được Màu, Saved bị khoá có lý do và CTA sign-in. Parametrized test tại dòng 20 phủ user/guest/anonymous Kèo không hiện tổng không được hỗ trợ và mở upcoming. Đây là test render/hành vi, không chứng minh native Light/Dark parity; native guest là **owner sim check**.

UI suite còn phủ defaults payload/draft/error, theme preview/Apply/storage, permission routes, assistant FAB route visibility và logout/account-switch. Lượt này không chạy `pnpm test`, không đưa kết quả unit cũ vào evidence hiện tại. Source trước/sau gates vẫn đúng HEAD; chỉ tài liệu thay đổi.

## Acceptance còn lại

Chưa đủ full-page visual acceptance hoặc 5/5 native: cần recapture các vùng thiếu ở bảng trên, đặc biệt Defaults moods/guidance, Profile identity/avatar Light/Dark và đúng Profile Light top; guest do owner kiểm tra Simulator. Không claim pixel parity, SE/chữ lớn/screen-reader/contrast đo trên thiết bị hoặc DEV acceptance. Nếu recapture cho thấy defect mới, sửa source rồi chụp lại build chứa fix; không gán ảnh d899e47 cho source mới. Không commit/push trong lượt này.
