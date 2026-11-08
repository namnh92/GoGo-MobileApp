# #537 — Account và khu vực mặc định · 2026-11-08

Phạm vi: worktree `mobile-537`, nhánh `feature/GOGO-537-account-header-save`, HEAD nền `a2dfdc1` + thay đổi chưa commit. Không commit/push.

## Nguồn Stitch đã đọc trực tiếp

Project `17315762413421369447`; dùng MCP `get_screen` và `download_file` đọc HTML lẫn ảnh:

- Account mới: `d5e6daa90cd74dbb85bd938e39f10d27` / HTML file `17677118906133588410` / ảnh `15160457368412962862`.
- Defaults cập nhật: `433670407807033328` / HTML file `15294009280743329062` / ảnh `433670407807031811`.

HTML/ảnh Defaults không đồng bộ: HTML đã có hàng Khu vực và Xoá khu vực; ảnh còn ba ô quận. HTML cũng còn radio GPS, nhưng owner yêu cầu ONE row trong lượt này. Account HTML có avatar; ảnh preview bị cắt avatar, vỡ chữ Lưu và tiêu đề Dữ liệu. Dùng HTML cùng chỉ thị owner 2026-11-08, không sao chép lỗi preview.

## Thay đổi

- Account: shared AppHeader sub-screen, Lưu dạng text + bell; avatar 96, edit badge và Gỡ ảnh khi có ảnh; card Thông tin cá nhân chứa tên/email khoá/ngày sinh + helper; card dữ liệu với nút export; xoá tài khoản giữ copy ADR-0023 và xác nhận có sẵn.
- Save giữ nguyên logic chỉ gửi dirty fields, ngày sinh null khi xoá, đồng bộ trường chưa sửa khi refetch, chặn save trùng và giữ nháp khi lỗi.
- Defaults: một hàng pin/Khu vực/value/chevron; clear nhỏ chỉ hiện khi đã đặt. Picker #524 dùng AppHeader sheet, chọn nháp và xác nhận trước khi đưa vào form. Không ghi app-wide area khi sửa defaults; payload chỉ gồm mã/version.
- vi/en, semantic theme tokens, foreground `accent.onAccent` trên nền accent. Email không có dữ liệu thì ẩn theo §0.1; không đưa sample vào app.
- Giữ các diff có sẵn ở Profile, logout ResultSheet một hàng, result-sheet tests và account-avatar tests; đã so diff trước/sau, bằng nhau.

## Bảng chênh lệch / acceptance

| Mục | Trạng thái / căn cứ |
| --- | --- |
| Header shared có bell, title trái, Lưu; chỉ một hàng khu vực, bỏ GPS trên Defaults | Owner yêu cầu trực tiếp 2026-11-08 trong task này, ưu tiên hơn HTML/preview cũ |
| Token, font, touch target tối thiểu 44; không sao chép mã màu/font riêng từ HTML | Owner yêu cầu tokens và a11y; shared design system |
| Gỡ ảnh chỉ khi có ảnh; email ẩn khi không có | Owner task và stitch-design.md §0.1 |
| Ngày sinh vẫn có hành động xoá khi có giá trị | Giữ semantics hiện có theo task; chỉ hiện theo dữ liệu/nháp |
| Khác biệt Defaults ngoài vùng khu vực | Không mở rộng task; các quyết định và chênh lệch nền ghi ở PR-g11-profile.md, chưa xác minh lại bằng ảnh native |
| 100% visual match Light/Dark | **Chưa xác minh: 0/2 màn so ảnh app cạnh Stitch ở cả hai theme.** CoreSimulatorService không truy cập được trong sandbox; không có capture native mới. Không báo Khớp Stitch 100% |
| Bảng workspace dev/handoffs/mobile-redesign-stitch-map.md | Ngoài writable roots; bảng local này là handoff, chưa cập nhật bảng workspace |

## Kiểm chứng

- `pnpm typecheck`: PASS, exit 0 (`/tmp/537-typecheck-final.log`).
- `pnpm lint`: PASS, exit 0 (`/tmp/537-lint-final.log`).
- `pnpm test`: exit 1; 135 files passed, 1 failed, 1 skipped; 1634 tests passed, 3 failed, 39 skipped (`/tmp/537-test.log`). Cả ba lỗi thuộc distribute-wrapper.test.ts:208/234/258 (process-lock checks). `/bin/ps` trực tiếp trả `operation not permitted` trong sandbox. Không sửa/skip các test này.
- `pnpm test:ui --runInBand`: PASS, exit 0; **198 suites / 2477 tests** (`/tmp/537-ui-final.log`).
- `git diff --check`: PASS.

Không claim DEV/backend acceptance hoặc kiểm chứng native, VoiceOver, chữ lớn, pixel parity.

## File và dòng

| File | Dòng / nội dung |
| --- | --- |
| src/features/account/account.view.tsx | 261 header; 301 avatar; 334 personal card; 357 data; 370 delete |
| src/features/account/account.style.tsx | 7 layout, token, dấu section, input và avatar |
| src/features/account/date-of-birth.view.tsx | 14 field embedded, helper, calendar, clear/error |
| src/features/account/date-of-birth.style.tsx | 7 style field embedded |
| src/features/account/profile-defaults.view.tsx | 136 single row; 205 shared picker |
| src/features/account/profile-defaults.style.tsx | 6 row/pin/clear |
| src/shared/location/current-area-sheet.view.tsx | 16 controlled selection; 56 AppHeader sheet |
| src/shared/location/current-area-sheet.spec.tsx | 113 kiểm tra không đổi app-wide area |
| src/shared/ui/material-icon.tsx | 7 download glyph |
| src/shared/i18n/vi.ts | 394 copy mới |
| src/shared/i18n/en.ts | 403 copy mới |
| src/features/__tests__/account-defaults.spec.tsx | 117 canonical confirm; 191 vi/en cancel, clear, single row |
| src/features/__tests__/account-date-of-birth.spec.tsx | 157 clear; 279 Light/Dark token, card, email lock, English |
