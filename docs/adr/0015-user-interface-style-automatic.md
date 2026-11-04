# ADR 0015 — `userInterfaceStyle: 'automatic'`, dark chưa hoàn chỉnh trên re-design

Trạng thái: chấp nhận · 2026-11-04 · GoGo-MobileApp#419 (PR #421) · Bổ sung ADR 0009

## Bối cảnh

ADR 0009 để dark mode ngoài phạm vi và `app.config.ts` giữ `userInterfaceStyle:
'light'`. Nền tảng theme của #419 thêm biến thể dark cho bốn theme màu nhấn và
theo cài đặt của thiết bị qua Unistyles, nên `app.config.ts` đặt
`userInterfaceStyle: 'automatic'`.

## Quyết định

1. **`userInterfaceStyle` là `automatic`.** Đây là thay đổi cấu hình native: cần
   build native mới (EAS hoặc `expo prebuild`); OTA không đủ. Mỗi bản build trước
   đó vẫn khoá ở light.
2. **Dark chưa hoàn chỉnh trên nhánh `re-design`, theo quyết định của chủ sản
   phẩm ngày 2026-11-04.** Màn hình chưa chuyển sang `StyleSheet.create(theme =>
   ...)` vẫn dùng màu light tĩnh (F-01). Chủ sản phẩm chấp nhận điều
   này chỉ cho `re-design`. Test `static-light-colours.test.ts` gắn với F-01: nó quét mọi `.tsx` dưới `src` (kể cả `src/shared/ui`) và giữ danh sách các
   chỗ còn lại, chỉ được giảm, và danh sách phải rỗng trước khi `re-design` merge
   vào `develop`.
3. **Splash theo sau ở issue #422.** Splash không đổi trong ADR này.

## Hệ quả

- Thiết bị đang để dark sẽ thấy các màn hình chưa chuyển ở dạng light hoặc pha
  trộn cho tới khi danh sách cho phép rỗng.
- Cần kiểm tra thủ công trên thiết bị thật sau build native mới.
