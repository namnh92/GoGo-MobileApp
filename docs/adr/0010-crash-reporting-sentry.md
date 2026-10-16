# ADR 0010 — Báo lỗi và crash bằng Sentry

**Trạng thái:** chấp nhận — 2026-10-14 · **Issue:** GoGo-MobileApp#336 (tách từ #21)
**Áp dụng:** GoGo-Infra ADR-0011 "Client error reporting on Sentry" (bản chuẩn, D-1…D-11). ADR này chỉ ghi cách app
thực hiện ADR-0011; chỗ nào hai bên khác nhau thì ADR-0011 thắng.

## Quyết định

- **Thư viện:** `@sentry/react-native` **8.30.0**, ghim đúng phiên bản. Project Sentry `gogo-mobile` (org `gogo-vn`).
- **Phạm vi:** lỗi JS chưa bắt, promise bị reject không xử lý, crash native iOS/Android, lỗi render qua root error
  boundary. Không tracing, không replay, không screenshot/view hierarchy, `sendDefaultPii: false`. Session (release
  health) bật theo GoGo-Infra ADR-0012a D-2: `enableAutoSessionTracking: true`, khoảng 30 s mặc định; session do SDK
  native gửi, không qua `beforeSend`, nội dung kiểm bằng lượt relay phần session.
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
- **User:** chỉ `{ id }` của user đã đăng nhập; khách và đăng xuất → `null`. Ngoại lệ đã chấp nhận (owner
  2026-10-14): crash native khi chưa có user mang `user.id` = installation id ngẫu nhiên do SDK native tự gắn (đo được
  trên Android, sentry-android 8.60.0); `beforeSend` không chạy trên crash native và SDK không có tuỳ chọn tắt. Event
  JS vẫn là `{ id }` hoặc không có `user`.
- **Redaction:** chạy mọi dòng của oracle `redaction-cases.v1.json`, vendored nguyên văn tại
  `src/shared/observability/__fixtures__/`:

  ```
  v1 sha256 decf6c4336269b086b209a4d27a9c36ca2c392b307c9d76e4b24883a4f4ef6a0  (GoGo-Infra 7c2a09a)
  ```

  Bỏ C-14.5/C-14.6 (chỉ CMS) — spec khẳng định đúng hai dòng đó. Redactor không dùng lookbehind và đã chạy qua Hermes.
- **Native:** ~~không thêm Expo config plugin, không đổi Metro~~ — **sửa 2026-10-15 (#340, pha 2):** có config plugin
  `@sentry/react-native/expo` (chỉ `organization`/`project`/`url`, đăng ký qua `plugins/with-sentry-uploads.js`) và
  `metro.config.js` = `getSentryExpoConfig`,
  xem mục *Upload symbol (pha 2)* bên dưới. SDK native tự link qua autolinking. `beforeSend` của JS
  không chạy trên crash native, nên breadcrumb mạng native của iOS (URL đầy đủ) bị tắt bằng
  `enableNetworkBreadcrumbs: false`, và mọi breadcrumb tự động native cũng tắt (iOS `enableAutoBreadcrumbTracking`,
  Android `enable{ActivityLifecycle,AppLifecycle,SystemEvent,AppComponent,NetworkEvent}Breadcrumbs`) vì chúng không qua
  hook JS nào — `ui.lifecycle` của iOS mang tiêu đề màn hình. Breadcrumb native gộp vào event JS đi qua cùng allowlist
  trong `beforeSend`; `user` của event JS chỉ lấy từ `setSentryUser`, không tin `user` event mang theo.
  SDK chép global/isolation scope sang native ngay khi ghi, và báo cáo crash/watchdog native dựng từ bản chép đó. Vì vậy
  `sentry.ts` bọc `setUser`, `setTag(s)`, `setExtra(s)`, `setContext`, `setAttribute(s)` để giá trị đã được rebuild và
  redact trước khi SDK chép. Lượt relay trên iPhone bắt được một báo cáo watchdog chứa giá trị thô trước khi có lớp bọc này.
- **Chỉ lỗi:** `sendClientReports: false` — client report là envelope thống kê, không phải lỗi.

## Hệ quả

- **Không upload source map, dSYM, ProGuard ở pha 1 (ADR-0011 D-5).** Frame JS của bản release bị minify; frame crash
  native chỉ có symbol hệ thống. Một crash native ở pha 1 đếm được và gắn được với release, **không đọc được**. Bản dev
  client (Metro) đọc được. Upload là issue riêng ở pha 2.
- **Upload symbol (pha 2, #340, 2026-10-15; GoGo-Infra ADR-0011 D-5 pha 2).** Shape:
  `dev/handoffs/sa-shape-mobile-340-sentry-uploads.fable.md` (workspace). Bản **Release** upload source map JS (Hermes,
  cả hai nền tảng) và dSYM (iOS) lên `gogo-mobile` ngay trong lúc build:
  - Config plugin đăng ký qua wrapper `plugins/with-sentry-uploads.js`, không bằng tuple `['@sentry/react-native/expo',
    {…}]` trong `app.config.ts`: Expo serialize mọi entry `plugins` kèm options vào config công khai nhúng trong binary
    (`EXConstants.bundle/app.config`) và manifest của dev server, nên org/project sẽ đi theo app (Astra F-21). Plugin ghi
    `ios/` và `android/` `sentry.properties` (org/project/url, **không** token), bọc phase Xcode
    "Bundle React Native code and images" bằng `sentry-xcode.sh`, thêm phase "Upload Debug Symbols to Sentry", và
    `apply from: sentry.gradle.kts`. `getSentryExpoConfig` gắn Debug ID vào bundle và map để Sentry khớp theo định danh; mọi
    tuỳ chọn khác tắt và ghi tên (middleware source context, `sentry.options.json`, release cho web, annotate, bọc
    error boundary, và hai gói chỉ-web replay/feedback resolve thành rỗng — `includeWebReplay`/`includeWebFeedback`
    mặc định là "có nếu được import") — còn lại thứ SDK luôn áp: gộp frame Sentry trong LogBox (dev) và resolve module
    chỉ-server thành rỗng. `scripts/lib/sentry-native.mjs` kiểm các điểm nối tại đúng chỗ build thực thi: thân hai
    phase Xcode chạy script SDK và **không nướng** dòng `SENTRY_*=` nào (plugin ghi `export
    SENTRY_DISABLE_AUTO_UPLOAD=true` khi được cho `disableAutoUpload`); cả hai phase nằm trong `buildPhases` của
    **target ứng dụng** (theo id, không tính target extension của OneSignal); dòng `apply from … sentry.gradle.kts`
    ngoài mọi comment `//` và `/* */` và không có `project.ext.shouldSentryAutoUploadGeneral` (bản Android của
    `disableAutoUpload`); `sentry.properties` không token. CI chạy qua `pnpm check:native`, script build chạy trước mỗi
    build có token.
  - Chạy qua `scripts/release-build.sh <ios|android> …`, gọi bằng GoGo-Infra `exec-with.sh <env>
    sentry/mobile-auth-token -- …` — token chỉ nằm trong env của tiến trình build. Hai trạng thái: có token → upload
    hỏng là build hỏng; không token → `SENTRY_DISABLE_AUTO_UPLOAD=true` + một dòng cảnh báo, build vẫn chạy. Script
    từ chối shell tracing (`set -x` in token), `SENTRY_ALLOW_FAILURE`, `SENTRY_DISABLE_XCODE_DEBUG_UPLOAD`,
    `SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD` (mỗi biến tạo trạng thái thứ ba: build xanh mà thiếu artifact),
    `.env.sentry-build-plugin`, **mọi dòng `SENTRY_` trong `ios/.xcode.env`, `.xcode.env.local`, `.xcode.env.updates`**
    (phase Xcode source ba file này *sau* khi script đã kiểm env — phase bundle source trực tiếp, phase dSYM qua
    `with-environment.sh` của react-native — nên một dòng ở đó tái tạo đúng trạng thái bị từ chối hoặc đưa token
    nằm trong file vào build), **mọi phép gán `SENTRY_*` trong file dotenv Expo nạp** (`.env`, `.env.local`,
    `.env.<mode>`, `.env.<mode>.local`; `expo run` nạp chúng qua `@expo/env` *sau* khi script đã kiểm, trước khi build
    native — Astra F-20; "phép gán" do chính parser dotenv của `@expo/env` quyết định qua
    `scripts/lib/dotenv-sentry-keys.mjs`, nên cả dạng `KEY: value` cũng bị từ chối và chỉ in tên biến, không in giá trị;
    `EXPO_PUBLIC_SENTRY_DSN` là config app, không khớp; `.env.example` không bao giờ được nạp), cấu
    hình khác Release, và thư mục native chưa nối upload. Sau các bước kiểm, script **tự đặt giá trị cuối** cho mọi công
    tắc (`SENTRY_DISABLE_AUTO_UPLOAD` = `false`/`true` theo token, `SENTRY_ALLOW_FAILURE`,
    `SENTRY_DISABLE_XCODE_DEBUG_UPLOAD`, `SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD` = `false`): SDK chỉ xét đúng chuỗi `true`,
    và `@expo/env` không ghi đè biến đã có. Test chạy `@expo/env` thật trong stub `expo run`. Build Release chạy thẳng
    `expo run` không qua script và không token sẽ **hỏng** ở bước upload (lỗi SDK nêu tên biến) — đúng ý.
  - **Vá SDK (pnpm patch, ghim 8.30.0):** `sentry-xcode-debug-files.sh` của SDK in `error:` khi upload dSYM hỏng rồi
    kết thúc file với exit 0 — build xanh, không có symbol native. `patches/@sentry__react-native@8.30.0.patch`
    (khai ở `pnpm-workspace.yaml`, áp khi `pnpm install`) thêm `exit "$UPLOAD_EXIT_CODE"` vào nhánh lỗi; không dựa
    vào việc Xcode có coi dòng `error:` là fatal hay không. `sentry-xcode-scripts.test.ts` chạy cả hai script SDK thật
    với một sentry-cli giả và ghim: dSYM hỏng → phase hỏng với đúng mã lỗi; `SENTRY_ALLOW_FAILURE=true` chỉ còn cảnh
    báo (lý do script build từ chối biến này); patch còn trong `node_modules`. **Nâng SDK phải xem lại patch** — nếu
    upstream đã sửa thì bỏ patch, chưa thì làm lại patch trên bản mới; test trên vẫn là cổng.
  - Cấu hình Debug (dev client) không upload.
  - **ProGuard/R8 không áp dụng:** bản release Android chưa minify (`android.enableMinifyInReleaseBuilds` mặc định
    tắt), frame Java đã đọc được. Bật minify là issue riêng, kéo theo upload mapping. Symbol NDK ngoài phạm vi.
  - Code mapping `gogo-mobile` đặt sau event symbolicate đầu tiên, theo đường dẫn frame thấy được.
  - Không đổi `sentry.ts`, redaction, oracle, allowlist (`debug_meta` đã có trong allowlist của ADR-0011 D-9).
- Thêm native module → mọi dev client đang cài trên máy test phải build lại.
- **Dev client Android:** expo-dev-launcher bắt exception native trước Sentry, nên crash native chỉ đo được trên bản
  release. iOS tự gửi báo cáo `WatchdogTermination` khi app bị kết thúc từ ngoài (kể cả `devicectl`); các báo cáo này
  cũng đi qua lớp bọc scope ở trên.
- **Kill switch:** tắt client key của `gogo-mobile` trên Sentry để ngừng lưu; build lại với `off` để ngừng gửi.
- **Rollback:** revert PR này; bản đã cài vẫn gửi tới khi build lại với `off` hoặc tắt client key.
  **Rollback riêng pha 2 (#340, Astra F-22):** revert PR #340 (bỏ wrapper plugin, `metro.config.js`,
  `scripts/release-build.sh`, patch + `pnpm-workspace.yaml`) → `pnpm install --frozen-lockfile` trên lockfile đã revert →
  **sinh lại cả hai project native**: `rm -rf ios android && npx expo prebuild --clean` (hoặc `prebuild -p <platform>
  --clean` trên từng máy build). `ios/` và `android/` bị gitignore và `expo run` dùng lại project native có sẵn, nên
  chỉ revert code thì phase upload, `sentry.properties` và `apply from … sentry.gradle.kts` vẫn còn — build Release
  không token khi đó vẫn thử upload và hỏng. Báo lỗi pha 1 (`sentry.ts`, DSN, redaction) không bị rollback này chạm tới.
  Token `ci/<env>/sentry/mobile-auth-token` thu hồi trên Sentry nếu bỏ hẳn pha 2.
