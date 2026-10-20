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
- **Redaction:** chạy mọi dòng của oracle `redaction-cases.v2.json`, vendored nguyên văn tại
  `src/shared/observability/__fixtures__/` (v1 bị thay ngày 2026-10-16, #341; v2 = mọi ca v1 không đổi + C-24.1…C-24.13):

  ```
  v2 sha256 5869939957e5f68280974f9d34fb8896d4df117873b84a3b19bf2e3edb7c213e  (GoGo-Infra#229)
  v1 sha256 decf6c4336269b086b209a4d27a9c36ca2c392b307c9d76e4b24883a4f4ef6a0  (GoGo-Infra 7c2a09a, đã thay)
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
- **Tag màn hình (#341, 2026-10-16; shape `dev/handoffs/sa-shape-mobile-341-screen-tag.fable.md` rev 3; sửa sau review
  PR #349 — Sol F-02/F-04/F-05, Astra A-F-01/A-F-03/F-03/F-04, vòng 3 F-04/F-05 (2026-10-17); owner 2026-10-16 "gán tag
  theo event"):** mọi event JS và crash native mang tag `screen` = route template của expo-router
  (`/room/[roomId]/preference`, `/(tabs)/plans`, màn khởi động = `/`) — tên file dưới `src/app/`, không bao giờ từ
  `usePathname()` (pathname mang mã phòng/mã mời thô; uuid thì
  redactor không che, C-21). Hai đường, mỗi đường một bảo đảm (mục *Hai đường gán tag* bên dưới): lỗi app tự báo (root
  error boundary → `captureError`) **đọc màn hình từ state của navigation container ngay lúc bắt** (`navigatorScreen()`
  trong `screen-tag.view.tsx`, đăng ký với `sentry.ts` qua `setScreenReader`); crash native và lỗi SDK tự bắt đọc **tag
  trong scope**, do `SentryScreenTag` (`screen-tag.view.tsx`, không render gì, gắn một lần trong `src/app/_layout.tsx`)
  ghi từ `useSegments()` trong effect qua `setSentryScreen`. **Cửa nhận (ADR-0011 D-12) nằm ở `admitScreen` trong
  `sentry.ts`**, áp cho cả giá trị ghi scope lẫn giá trị đọc lúc bắt, trước khi SDK chép scope sang native hay gửi event,
  dù ai gọi hay reader trả gì: giá trị có trong `screen-templates.ts` (sinh từ danh sách file `src/app/`, test khoá hai
  bên khớp nhau) và đi qua redactor không đổi thì gửi nguyên văn; mọi giá trị khác (pathname mang mã, uuid, slug chỉ chữ như
  `/places/alice`, query, fragment, thiếu/thừa `/`, thêm segment, khác hoa thường) gửi thành `unknown` — bảng A-1…A-11
  của D-12 chạy trong `screen-tag.spec.tsx`. Thành viên danh sách, không phải hình dạng: regex nhận `/places/alice`,
  redactor giữ uuid (C-24.12); cả hai không nói giá trị từ đâu ra. `unknown` là sentinel được chấp nhận (bổ sung D-7 số 4
  trên GoGo-Infra#208, 2026-10-16 — thay câu "template không khớp mẫu thì bỏ tag" của bổ sung số 3): SDK native không xoá
  được tag (`undefined` tới native thành chuỗi `"undefined"`), giữ tag cũ thì chỉ sai màn; oracle C-24.13 khoá redactor
  giữ nguyên sentinel. Tập giá trị rời máy = danh sách template ∪ `unknown`. `getIsolationScope().setTag('screen', …)`:
  lớp bọc scope redact giá trị, SDK chép sang native scope, nên crash native mang cùng tag mà không cần code native.
  Redactor stage 2 giữ segment thô đúng dạng placeholder (`[name]`, `:name`, `name` chỉ gồm chữ) sau `r | l | invite |
  share-links` — mã thật chỉ gồm `[A-Za-z0-9_-]` (ADR-0011 D-9, C-24). Mọi template của app được test đi qua redactor
  không đổi và được gửi nguyên văn.
  **Khởi động:** `initSentry` gieo `/` ngay khi bật SDK, trước khi render gì (Sol F-05, Astra A-F-03) — lỗi trong
  `AppProviders` hay cây khởi động mang `/`, không trống; iOS giữ native scope qua các lần chạy (đo ở relay #336: crash
  lần chạy 2 mang tag đặt ở lần 1) nên không gieo thì crash sớm mang màn của lần chạy trước. Cửa sổ còn lại: crash native
  giữa lúc SDK native khởi động và lúc tag `/` tới native scope, trên iOS có thể mang màn lần chạy trước — **owner quyết
  2026-10-16 (Astra F-03 trên PR #230/#349, ghi ở `execution-policy.md` §8): không chấp nhận, không vá native.** Cửa sổ
  này **đo bằng lượt relay trên máy thật**: crash native iOS gây trong khoảng từ lúc SDK native khởi động tới lúc tag `/`
  tới native scope; **merge GoGo-Infra PR #230 và GoGo-MobileApp PR #349 chờ phép đo đó.** Android chưa có lần đo nào
  thấy cửa sổ này. Báo cáo crash của lần chạy trước được ghi cùng scope lúc crash, gieo `/` không viết đè: relay §3.1
  kiểm — lần chạy 3 giao crash của lần 2 với tag `/room/[roomId]/preference` (màn lúc crash của lần 2), không phải `/`.
  **`?screen=` trong link (Sol F-01/F-04, đo trong test):** expo-router nối nguyên giá trị query `?screen=` vào segment
  của màn lá (`/places/search?screen=import` → `places,search,import`) và giữ `index` với thư mục có index
  (`/plans/<id>?screen=active` → `plans,[planId],index,active`), nên link lạnh hay link nóng từ hệ điều hành (qua
  `+native-intent`) chỉ cho ra `unknown`, không ra màn khác; chỉ một template lá không-index là tiền tố của template khác
  mới mở lại đường này — test khoá cây `src/app/` không có route như vậy; thêm route như vậy phải có chốt mới trước.
  **Hai đường gán tag (Sol F-02 / Astra F-04; owner 2026-10-16 chọn "gán tag theo event" thay vì chấp nhận cửa sổ
  mount):** root layout nhận segment mới ở commit *sau* commit mount màn mới — đo trên chính `SentryScreenTag` với cả
  `useEffect` lẫn `useLayoutEffect`, bằng chứng `dev/test-evidence/mobile-341-2026-10-16/sol-f02-writer-layout-effect.txt`
  (prop thử nghiệm `useWriteEffect` đã bỏ) — và khi boundary đã bắt lỗi thì navigator bị gỡ, scope không bao giờ học
  được màn mới. Vì vậy:
  - **Đường JS — lỗi app tự báo qua root error boundary:** `captureError` đọc màn hình ngay lúc bắt, đồng bộ trong
    `componentDidCatch`, từ state thô của navigation container (`navigatorScreen()`: handle container giữ lại từ commit
    ổn định gần nhất, vì ref của expo-router tháo handle trong mutation phase của chính commit dựng fallback và chỉ gắn
    lại sau `componentDidCatch` — probe `astra-f04-probe-ref-current-null-at-didcatch.txt`; trước commit đầu tiên thì
    `store.state` = state khởi đầu expo-router suy từ URL mở app; đặt tên bằng `getRouteInfoFromState` của chính
    expo-router — hàm nuôi `useSegments()` — nên hai đường đặt tên màn giống nhau). State này đổi ngay khi dispatch điều
    hướng, trước khi màn mới render, nên lỗi ném trong render, `useLayoutEffect`, `componentDidMount` hay `useEffect` của
    màn mới mang **đúng màn đó**: `screen-tag.spec.tsx` "a JS event carries the screen the navigator holds at capture" —
    FAIL trên 3d15373 (nhận màn trước `/places/search`, `astra-f04-fail-before-3d15373.txt`), PASS sau. Đo thêm, cùng
    spec: tab `(tabs)/plans` mở lạnh bằng link hay đẩy bằng `router.push` khi tab navigator mới mount, lỗi ở render hay
    `componentDidMount` đều mang `/(tabs)/plans`; link lạnh mang `?screen=<anh em>` cho `unknown` (A-10), không cho màn
    anh em; lỗi trước khi có state navigator nào (providers hỏng ở commit đầu, không URL) mang `/` đã gieo. Không đọc
    trong `beforeSend`: nó chạy ở microtask sau, khi cleanup của commit lỗi có thể đã quên state.
    **Vắng ≠ hỏng (Astra F-05, vòng 3, 2026-10-17):** reader trả `null` chỉ khi *chưa có state navigator nào* (trước commit
    đầu) — tag để cho scope, `/` đã gieo đứng; state có mà đọc hay đặt tên thất bại (`getRouteInfoFromState` ném lỗi với
    hình dạng state nó không biết — sau một lần đổi expo-router không tương thích) thì reader **ném**, `screenTag` trong
    `sentry.ts` bắt và gửi `unknown` qua `admitScreen`, không để event thừa kế màn trước đang nằm trong scope mà không có
    dấu gì là cũ; báo cáo vẫn đi (ném trong `componentDidCatch` là chết app). Pin: `screen-tag.spec.tsx` "a throw while
    naming an existing navigation state is tagged `unknown`" — FAIL trên ab6d111 (`Expected "unknown" / Received
    "/places/search"`, `astra-f05-fail-before-ab6d111.txt`), PASS sau; hợp đồng phía boundary (null → scope đứng, ném →
    `unknown`, giá trị → `admitScreen`) pin riêng trong `sentry.spec.ts` "the screen read at capture".
    Hai module nội bộ expo-router (`build/global-state/router-store`, `routeInfo`) là import đường dẫn trong, không có tiền
    lệ production; ba kiểu lệch khi đổi bản expo-router, mỗi kiểu một lưới riêng: (a) module dời/đổi tên → hỏng ngay lúc nạp
    (suite không nạp được, bundle Metro lỗi), không âm thầm; (b) đổi ngữ nghĩa state nội bộ mà đường dẫn giữ nguyên →
    **không** hỏng lúc nạp — chỉ các ô hành vi của spec chạy qua router thật (link lạnh, push nóng, tab mount, bốn pha mount,
    `?screen=`) bắt được, nên suite này là cổng mỗi lần nâng expo-router, một ô đỏ nghĩa là xem lại reader, không sửa
    expected; (c) lúc chạy thật: đọc/đặt tên ném lỗi → `unknown` (F-05); trả về một template *có khai báo* nhưng sai màn →
    lúc chạy không gì phát hiện được, chỉ spec khi nâng bản bắt — đó là phần còn lại của sự phụ thuộc này. Q-3 (lỗi render
    đầu mang màn trước, shape §5) không còn cần cho đường này.
  - **Đường native (crash native, watchdog) và lỗi SDK tự bắt (unhandled error / rejection):** đọc tag trong scope, tức
    giá trị `setSentryScreen` ghi gần nhất — màn đã ổn định, chậm một commit so với mount. Crash native không chạy được
    JS nên không có cách gán theo event. Cơ chế ghi scope **không hứa** đúng màn cho hai ô dưới đây, và cả hai **không phải
    giới hạn được chấp nhận** — owner không chấp nhận cửa sổ mount (phán quyết F-04, 2026-10-16) và cũng không cho ngoại lệ
    native-mount (Astra F-04 nửa còn lại, vòng 3, 2026-10-17); chỉ hai phần dư (a), (b) ghi ở ô thứ hai là giới hạn owner
    chấp nhận 2026-10-20 — mà là **ô AC**, đo trong lượt relay trên máy thật (cổng PR, cùng lượt với cửa sổ khởi động ở
    trên); mong đợi theo D-7 bổ sung 3 (tag = màn của event) và phán quyết F-04; nhận màn trước là **FAIL** → finding trả về vai SA, không phải giới hạn được chấp nhận, không phải lỗi script:
    - *Rejection SDK bắt trong commit mount* — **owner quyết 2026-10-16 (trong phiên, ghi ở
      `dev/handoffs/review-state-GoGo-MobileApp-349.md`): đưa vào AC, không để là giới hạn ngoài AC.** Điều hướng *nóng*
      từ màn đang ổn định sang màn mới; promise bị reject không xử lý ngay trong commit mount của chính màn mới (render /
      `useLayoutEffect` / `componentDidMount`); SDK bắt qua unhandled rejection, không `throw` cho error boundary bắt (đó
      là đường JS đã đo ở trên); **mong đợi `screen` = template của màn mới vừa mount.** Lỗi SDK tự bắt thường xảy ra sau
      khi điều hướng xong (handler, promise, timer) nên tag đã đúng; ô này là trường hợp còn lại.
    - *Crash native trong commit mount* (Astra F-04 nửa còn lại): điều hướng *nóng* từ màn đang ổn định sang màn mới; crash
      native gây ngay trong commit mount của chính màn mới (`useLayoutEffect` / `componentDidMount`);
      **mong đợi `screen` = template của màn mới vừa mount.** Lượt relay `r341-20261019T1350Z` (BLOCKED do lệch, chỉ là tín
      hiệu) cho màn trước trên cả hai máy, đúng dự báo → **SA-341-02** (`dev/handoffs/sa-ruling-mobile-341-relay.fable.md`).
      Ghi "lúc dispatch" theo nghĩa đen không dùng được: sự kiện `__unsafe_action__` bắn **trước** `setState`, và hoãn sang
      microtask thì thua microtask React đang chờ (`setX(); router.push()`) — gán sai mà không dấu hiệu. **Cơ chế (owner
      chốt 2026-10-20):** ghi scope **lúc mount** qua `screenLayout` của React Navigation — `screenTagLayout`
      (`screen-tag.view.tsx`) đặt `ScreenMountTag` trước cây con của mỗi màn, trên **mọi navigator** (`app/_layout.tsx`
      Stack, `app/(tabs)/_layout.tsx` Tabs; `sentry-usage.spec.ts` ghim). Layout effect chạy theo thứ tự cây, nên lần ghi
      này (đọc `navigatorScreen()`, state container đã đổi lúc dispatch; đọc lỗi → `unknown`; chưa có state → không ghi)
      xếp vào hàng đợi native trước mọi layout effect và `componentDidMount` của màn mới. Lần ghi
      settled của `SentryScreenTag` giữ nguyên cho những gì không phải mount (pop về màn đã mount, đổi tab, state lồng đẩy
      lên sau mount) và sửa `unknown` tạm thời. **Phần dư, owner chấp nhận 2026-10-20, không hứa — cả hai đứng trước mọi
      layout effect nên vẫn mang màn trước:** (a) lời gọi native *trong lúc render* màn mới (Q-R6) — render thuần theo
      hợp đồng React, app gọi native từ effect và handler; `throw` JS trong render là đường event-local (R-7); (b) crash
      *bên trong view native* lúc React mount nó (pha mutation, Sol F-06 vòng 3 PR #349) — phủ được chỉ bằng ghi phía
      native, owner đã không cho vá native. Ô R-6 (crash trong `useLayoutEffect`) đo lại trong run mới.

    **Ba ô còn mở, cùng một danh sách với ADR-0011 D-12 (GoGo-Infra), đều chờ đo trong một lượt relay sạch kế tiếp
    (lượt `r341-20261019T1350Z` BLOCKED do lệch, chỉ là tín hiệu) và đều giữ merge PR #349 + GoGo-Infra PR #230:** (1)
    cửa sổ khởi động iOS (F-03, mục *Khởi động* ở trên — không chấp nhận, không vá native); (2) rejection SDK bắt trong
    commit mount; (3) crash native trong commit mount. Giới hạn đã ghi trên đường native/SDK chỉ là hai phần dư (a), (b) ở ô (3).
  Tag lên Discord qua `data.tags` của workflow `6164950` sau bổ sung D-7 trên GoGo-Infra#208.
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
  - Không đổi `sentry.ts`, redaction, oracle, allowlist (`debug_meta` đã có trong allowlist của ADR-0011 D-9) — đúng ở
    #340; #341 sau đó thêm `setSentryScreen`, `setScreenReader` + `captureError` đọc màn lúc bắt, luật placeholder và
    oracle v2 (mục *Tag màn hình*).
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
