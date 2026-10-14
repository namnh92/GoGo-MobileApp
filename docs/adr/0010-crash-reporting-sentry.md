# ADR 0010 — Báo lỗi và crash bằng Sentry

**Trạng thái:** chấp nhận — 2026-10-14 · **Issue:** GoGo-MobileApp#336 (tách từ #21)
**Áp dụng:** GoGo-Infra ADR-0011 "Client error reporting on Sentry" (bản chuẩn, D-1…D-11). ADR này chỉ ghi cách app
thực hiện ADR-0011; chỗ nào hai bên khác nhau thì ADR-0011 thắng.

## Quyết định

- **Thư viện:** `@sentry/react-native` **8.30.0**, ghim đúng phiên bản. Project Sentry `gogo-mobile` (org `gogo-vn`).
- **Phạm vi:** lỗi JS chưa bắt, promise bị reject không xử lý, crash native iOS/Android, lỗi render qua root error
  boundary. Không tracing, không replay, không screenshot/view hierarchy, không session, `sendDefaultPii: false`.
  Không ghi `contract` trên Mobile ở pha 1: app không có tầng Zod trung tâm cho response.
- **Không gửi:** `ApiError`, `NetworkError`, `TimeoutError`, `AbortError` — lọc theo `error.name` (không đổi khi
  minify), không bao giờ theo nội dung message.
- **Chỗ khởi tạo duy nhất:** `src/shared/observability/sentry.ts`. `bootstrap.ts` gọi `initSentry` và gắn user là
  import đầu tiên của `src/app/_layout.tsx`. `sentry-usage.spec.ts` đỏ khi file khác import SDK hoặc gọi thêm hàm SDK.
- **DSN:** `EXPO_PUBLIC_SENTRY_DSN` từ build env (SSM `/gogo/<env>/mobile/sentry/dsn` qua `mobile-env.py`). Rỗng hoặc
  đúng chữ `off` = không khởi tạo, mọi helper là no-op (jest, dev local, CI). `app.config.ts` từ chối build `stag`/`prod`
  không có DSN hoặc `off`; `OFF`, `false`, `0` là lỗi gõ, không phải quyết định.
- **Environment:** `dev | staging | prod` theo flavour (`stag → staging`), không lấy từ `__DEV__`. `release`/`dist`
  do SDK đọc từ native (`max.gogo.<flavour>@<version>+<build>`, kiểm trên envelope đầu tiên của lượt relay).
- **User:** chỉ `{ id }` của user đã đăng nhập; khách và đăng xuất → `null`.
- **Redaction:** chạy mọi dòng của oracle `redaction-cases.v1.json`, vendored nguyên văn tại
  `src/shared/observability/__fixtures__/`:

  ```
  v1 sha256 decf6c4336269b086b209a4d27a9c36ca2c392b307c9d76e4b24883a4f4ef6a0  (GoGo-Infra 7c2a09a)
  ```

  Bỏ C-14.5/C-14.6 (chỉ CMS) — spec khẳng định đúng hai dòng đó. Redactor không dùng lookbehind và đã chạy qua Hermes.
- **Native:** không thêm Expo config plugin, không đổi Metro. SDK native tự link qua autolinking. `beforeSend` của JS
  không chạy trên crash native, nên breadcrumb mạng native của iOS (URL đầy đủ) bị tắt bằng
  `enableNetworkBreadcrumbs: false`; breadcrumb native gộp vào event JS đi qua cùng allowlist trong `beforeSend`.
  SDK chép global/isolation scope sang native ngay khi ghi, và báo cáo crash/watchdog native dựng từ bản chép đó. Vì vậy
  `sentry.ts` bọc `setUser`, `setTag(s)`, `setExtra(s)`, `setContext`, `setAttribute(s)` để giá trị đã được rebuild và
  redact trước khi SDK chép. Lượt relay trên iPhone bắt được một báo cáo watchdog chứa giá trị thô trước khi có lớp bọc này.
- **Chỉ lỗi:** `sendClientReports: false` — client report là envelope thống kê, không phải lỗi.

## Hệ quả

- **Không upload source map, dSYM, ProGuard ở pha 1 (ADR-0011 D-5).** Frame JS của bản release bị minify; frame crash
  native chỉ có symbol hệ thống. Một crash native ở pha 1 đếm được và gắn được với release, **không đọc được**. Bản dev
  client (Metro) đọc được. Upload là issue riêng ở pha 2.
- Thêm native module → mọi dev client đang cài trên máy test phải build lại.
- **Dev client Android:** expo-dev-launcher bắt exception native trước Sentry, nên crash native chỉ đo được trên bản
  release. iOS tự gửi báo cáo `WatchdogTermination` khi app bị kết thúc từ ngoài (kể cả `devicectl`); các báo cáo này
  cũng đi qua lớp bọc scope ở trên.
- **Kill switch:** tắt client key của `gogo-mobile` trên Sentry để ngừng lưu; build lại với `off` để ngừng gửi.
- **Rollback:** revert PR này; bản đã cài vẫn gửi tới khi build lại với `off` hoặc tắt client key.
