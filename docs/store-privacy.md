# Khai báo dữ liệu cho App Store và Google Play

**Trạng thái:** nguồn duy nhất để điền hai form khai báo (Apple privacy nutrition labels, Google Play Data
safety) và phần metadata listing. Đọc trên `develop` ngày 2026-10-17 (GoGo-MobileApp#354, tách từ #21
APP-010).

Luật của tài liệu: **mỗi dòng dữ liệu phải dẫn được tới nơi code thật gửi nó** (`file:line`), tới hàng cấu
hình, hoặc tới tài liệu nhà cung cấp. Dòng nào không dẫn được thì ghi `CẦN XÁC NHẬN`, không suy đoán — một
khai báo sai là lý do bị từ chối bản nộp hoặc bị gỡ khỏi cửa hàng, không phải một lỗi chữ.

## 1. Sáu đích dữ liệu

| Đích | Vai trò | Quan hệ |
| --- | --- | --- |
| GoGo BE (`https://api-*.gogo.id.vn/v1`) | máy chủ của chính sản phẩm | của GoGo |
| OneSignal | gửi push | nhà cung cấp xử lý theo uỷ quyền |
| Tenjin | đo nguồn cài đặt (attribution) | **bên thứ ba nhận dữ liệu chia sẻ** (owner chốt 2026-10-17, §12 D-2) |
| Adjust | đo nguồn cài đặt (attribution), MMP thứ hai cạnh Tenjin (GoGo-MobileApp#363/#367) | **bên thứ ba nhận dữ liệu chia sẻ** (§12 D-5, cùng lập trường D-2) |
| Sentry | crash/error + session release-health | nhà cung cấp xử lý theo uỷ quyền |
| Google Maps Platform | vẽ bản đồ trong app (SDK Maps, **cả iOS và Android**) | nhà cung cấp xử lý theo uỷ quyền |

Truyền qua HTTPS — **có điều kiện, chưa chứng minh được từ repo này.** `z.url()` chỉ kiểm hình dạng URL,
không kiểm scheme (`src/shared/config/env.ts:10`), nên `http://` vẫn qua; không có chỗ nào trong `env.ts` hay
`src/shared/api/client.ts` chặn cleartext. Mẫu dùng `https://api-dev.gogo.id.vn/v1` (`.env.example:12`).
Khẳng định HTTPS vì vậy dựa vào giá trị prod cộng mặc định nền tảng (ATS trên iOS, `usesCleartextTraffic` trên
Android) và **phải xác nhận trên Info.plist / AndroidManifest của bản release** — `/ios` và `/android` không
nằm trong git (`.gitignore:12-13`) nên không đọc được ở đây. Đó là một dòng kiểm của lane build (#350, #351).

Không có SDK analytics **của chính GoGo**: `track()` chỉ `console.debug` tại máy, không gửi đi đâu
(`src/shared/analytics/index.ts:56-58`) — và không đường nào chuyển tiếp nó, vì breadcrumb `console` bị bỏ
(`src/shared/observability/sentry.ts:681-701`) và mọi breadcrumb tự động của SDK native đều tắt (`:844-850`).
Mục đích "Analytics" xuất hiện ở §6/§7 đến từ Tenjin (D14) và dữ liệu phiên của OneSignal (T1), không từ
`track()`. Token phiên nằm trong Keychain/Keystore, không gửi cho ai
(`src/shared/storage/secure-store.ts:3,8`).

### 1.1 Chuyển lúc build, không phải lúc chạy (#413)

Mục này không phải dữ liệu của người dùng app, không thuộc khai báo Apple hay Play, khác D15, D16, T3. Mỗi lần lane Firebase (dev, stag) chạy với token, máy build gửi nguyên file build lên Sentry Size Analysis, project `gogo-vn/gogo-mobile`. Bản prod không đi đường này.

| Gửi đi | iOS (xcarchive) | Android (APK) |
| --- | --- | --- |
| Binary đã ký, bundle Hermes, tài nguyên | có | có |
| dSYM | có | không |
| Bundle id `max.gogo.<env>`, version, build number | có | có |
| Config public: URL API và web, DSN Sentry, OneSignal app id, khoá SDK Tenjin, app token Adjust, `GOGO_BUILD_SHA` | có | có |
| Khoá Google Maps của nền tảng (đã giới hạn, ADR 0008) | có | có |
| **Profile Ad Hoc của app và notification extension: UDID máy tester, là định danh thiết bị** | có | không |
| Metadata upload: SHA, branch, repo, nhà cung cấp VCS (`github`), cấu hình build (`Release`), ghi chú release có tên máy build | có | có |

- Dữ liệu người dùng app: không dự kiến có trong file build. Hàng UDID cần đối chiếu trên xcarchive thật ở bản đo đầu.
- Secret không nằm trong file build: keystore, khoá App Store Connect, service account Firebase, token Sentry.
- Giữ bao lâu: kết quả size 90 ngày theo mã nguồn Sentry. **Thời hạn giữ và quyền truy cập file build gốc: chưa biết**, tài liệu Sentry không nêu. Redaction của SDK không xử lý file này.
- Build Distribution tắt từ 2026-11-04 (`Settings → Mobile Builds`). Đây là thiết lập console, không có IaC ghim, ai có quyền project bật lại được mà không có cảnh báo, cùng giới hạn đã nêu ở §3.

## 2. Dữ liệu app tự gửi

| # | Dữ liệu | Code gửi | Đích | Mục đích | Gắn danh tính | Bắt buộc |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Email | `openapi/gogo.v1.yaml:236` (register), `:270` (login); `src/shared/api/endpoints/sessions.ts:17,22` | GoGo BE | tạo và đăng nhập tài khoản | có | bắt buộc khi đăng ký (phiên khách không cần) |
| D2 | Mật khẩu | `openapi/gogo.v1.yaml:237,271` | GoGo BE | xác thực | có | như D1 |
| D3 | Tên hiển thị | `openapi/gogo.v1.yaml:238` (register), `:323` (createGuestSession), `:935` (joinRoomAsGuest) | GoGo BE | hồ sơ, hiển thị trong phòng | có | bắt buộc khi đăng ký **và** khi vào phòng với tư cách khách |
| D4 | Ngày sinh | `src/shared/api/queries/use-me.ts:38`, `endpoints/sessions.ts:52` | GoGo BE | xem Q5 | có | tuỳ chọn |
| D5 | Ảnh đại diện | `src/shared/media/pick-avatar.ts:59,65` → `src/shared/api/queries/use-uploads.ts:46-58` → `endpoints/profile.ts:10` | GoGo BE + object storage (PUT presigned) | hồ sơ | có | tuỳ chọn |
| D6 | Ảnh check-in (≤ 3) và ảnh hoá đơn | `openapi/gogo.v1.yaml:2969,2978` (`photoKeys`, `billPhotoKey`); cùng đường upload D5 | GoGo BE + object storage | nội dung người dùng, đối chứng chi tiêu | có | tuỳ chọn |
| D7 | Số tiền hoá đơn tự khai, số người | `openapi/gogo.v1.yaml:2973,2977` (`billTotal`, `billPeopleCount`, request của check-in) | GoGo BE | chia tiền, đối chiếu ngân sách | có | tuỳ chọn |
| D8 | Đánh giá: điểm + nội dung chữ | `openapi/gogo.v1.yaml:3122-3123` (request của createReview); `endpoints/me.ts:24,32` | GoGo BE | nội dung người dùng, kiểm duyệt | có | tuỳ chọn |
| D9 | Điểm, ghi chú và tag của check-in | `openapi/gogo.v1.yaml:2963,2964,2968` (`rating`, `tags`, `note`) | GoGo BE | nội dung người dùng | có | tuỳ chọn |
| D10 | Toạ độ chính xác | lấy: `src/shared/location/fresh-position.ts`, `use-current-location.ts`; gửi và **lưu trên phòng**: `src/shared/store/roomStore.ts:252-253` → `endpoints/rooms.ts:18,69` (`openapi/gogo.v1.yaml:10517-10518`); gửi không lưu: `src/features/search/search.view.tsx:133-134`, `src/shared/administrative/queries.ts:44` | GoGo BE | gợi ý địa điểm gần, suy ra khu vực hành chính, gốc của lịch trình | có — không phải vì token (hai đường tìm kiếm/khu vực gửi `anonymous: true`: `endpoints/places.ts:8`, `administrative/queries.ts:45`), mà vì toạ độ gốc nằm trên phòng của người dùng và BE vẫn thấy IP | tuỳ chọn — có đường chọn khu vực thủ công, chuỗi quyền nói đúng điều đó (`app.config.ts:271-274`) |
| D11 | Truy vấn tìm kiếm địa điểm | `src/features/search/search.view.tsx:124-143` → `src/shared/api/endpoints/places.ts:7-8` | GoGo BE | tìm kiếm | có — request là `anonymous: true` (`places.ts:8`, token bị bỏ ở `client.ts:239`), nhưng BE vẫn thấy IP và cùng người dùng còn các đường có phiên | tuỳ chọn |
| D12 | Id đăng ký push + nền tảng | `src/shared/api/endpoints/me.ts:97`; `openapi/gogo.v1.yaml:3170-3205` | GoGo BE | biết người dùng còn nhận được thông báo không | có | tuỳ chọn (theo quyền thông báo) |
| D13 | `external_id` = `users.id` + token ES256 ngắn hạn | `src/shared/notifications/identity-session.ts` (`bindUser`); token lấy ở `identity-api.ts:21` | OneSignal | định danh thiết bị để gửi push đúng người | có | tuỳ chọn |
| D13a | `external_id` = `device:<id>` + token ES256 ngắn hạn, chỉ khi không có session user và đã trả lời "Tiếp tục" trên sheet ưu đãi (GoGo-MobileApp#398). Không gắn tài khoản | `src/shared/notifications/identity-session.ts` (`bindDevice`); token lấy ở `device-identity-api.ts` | OneSignal | gửi ưu đãi chung cho máy chưa đăng nhập | không | tuỳ chọn (sheet, công tắc) |
| D14 | Sự kiện cài đặt / mở app + tham số attribution | `src/shared/acquisition/bootstrap.ts:19-26`, `initialize.ts:39-43` (`initialize` → `setAppStore` → `connect`), `deferred-link.ts:40-46,124` (`getAttributionInfo`) | Tenjin | đo nguồn cài đặt, mở deferred deep link | gắn định danh thiết bị (xem T2 §3) | tuỳ chọn |
| D15 | Crash, lỗi, breadcrumb đã lọc | `src/shared/observability/sentry.ts:733` (`beforeSend`), `:699` (`beforeBreadcrumb`), `:823-845` | Sentry | sửa lỗi | `user.id` = id người dùng khi đã đăng nhập, ngược lại là installation id của SDK native (`sentry.ts:726-731,733`, ADR 0010) | tuỳ chọn theo DSN của bản build |
| D16 | Session release-health (`sid`, `did`, status, counters, `seq`) | `src/shared/observability/sentry.ts:14-19,825` | Sentry | tỉ lệ crash-free | `did` = installation id native, **không** phải id người dùng | như D15 |
| D17 | Nội dung phòng: tên phòng, ngày/giờ kèo, ngân sách + chế độ (tổng / theo đầu người), khu vực | `src/shared/api/endpoints/rooms.ts:18,69,135` | GoGo BE | chức năng cốt lõi của sản phẩm | có | bắt buộc để dùng app |
| D18 | Sở thích đã chọn, lượt vuốt và lượt bỏ phiếu | `src/shared/api/endpoints/preferences.ts:15,25`; `endpoints/suggestions.ts:23,37` | GoGo BE | ghép lựa chọn, bỏ phiếu, chốt kế hoạch | có | bắt buộc theo luồng |
| D19 | Thành viên phòng và lời mời đã tạo | `src/shared/api/endpoints/rooms.ts:139,149,164,171,176` | GoGo BE | quản lý phòng, mời người đi cùng | có | bắt buộc theo luồng |
| D20 | Mục đã lưu (địa điểm, kế hoạch) | `src/shared/api/endpoints/me.ts:14,18` | GoGo BE | danh sách đã lưu | có | tuỳ chọn |
| D21 | Cài đặt thông báo | `src/shared/api/endpoints/me.ts:83` | GoGo BE | tôn trọng lựa chọn nhận thông báo | có | tuỳ chọn |
| D21a | Mã thiết bị ngẫu nhiên do BE cấp, nền tảng, id đăng ký push, trạng thái công tắc ưu đãi + số phiên bản lựa chọn (GoGo-MobileApp#398) | `src/shared/notifications/device-identity-api.ts`; `openapi/gogo.v1.yaml` (`/notifications/identity/device`, `/notifications/device-subscriptions`) | GoGo BE | gửi ưu đãi chung, tôn trọng lựa chọn nhận | không — không có liên kết tài khoản (GoGo-BE ADR-0038) | tuỳ chọn (sheet, công tắc) |
| D22 | Thay đổi lịch trình: khoá điểm, hoàn thành điểm, tạo lại | `src/shared/api/endpoints/plans.ts:19,24,35,47` | GoGo BE | chức năng cốt lõi | có | bắt buộc theo luồng |
| D23 | Đề xuất địa điểm: link Google Maps đã dán, ghi chú tự do, category, mood keys, khoảng giá tự khai | `src/features/place-import/import.view.tsx:176` (resolve link), `:145-156` (category, vibes, estimatedPrice, note), `:205` (submit) | GoGo BE | góp địa điểm, kiểm duyệt | có | tuỳ chọn |
| D24 | Phiên cài đặt / mở app + callback attribution và deferred deep link của Adjust | `src/shared/acquisition/bootstrap.ts:170-249` (`runAdjust`, `startAdjustSdk`; chỉ nạp wrapper sau khi `adjust/native-preflight.ts` thấy module native), `src/shared/acquisition/adjust/initialize.ts:56-74` (`disableDeferredDeeplinkOpening` → `setAttConsentWaitingInterval(60)` → callback → `initSdk`), `adjust/deferred-link.ts` (chỉ ghi link GoGo vào `PendingDeepLinkStore`) | Adjust | đo nguồn cài đặt, mở deferred deep link | gắn định danh thiết bị (T5) | tuỳ chọn — dev không token thì không chạy; stag/prod token hoặc `off` |

Mã mời và slug của link chia sẻ không mang PII theo `security.md`, nên không là một dòng dữ liệu người dùng.
Hành vi chuyển tiếp, không phải thu thập, nhưng phải biết trước khi nộp: `src/shared/navigation/directions.ts:7`
đặt địa chỉ điểm đến vào URL `google.com/maps/dir` rồi `Linking.openURL` — người dùng tự bấm, app không gửi gì,
nhưng Google nhận địa chỉ đó qua trình duyệt hoặc app Maps.

Không gửi: danh bạ, lịch, tin nhắn, sức khoẻ, thông tin thanh toán, mật khẩu của bên thứ ba, vị trí nền
(`app.config.ts:275-276` tắt cả hai nền tảng).

## 3. Dữ liệu SDK thứ ba tự thu (phải khai dù app không viết dòng nào)

| # | SDK | Nhà cung cấp nói nó thu gì | Nguồn |
| --- | --- | --- | --- |
| T1 | OneSignal | "Device OS", "Device Language", "Timezone", "Country", "App Version", "Device Model", "Application Identifier", "Cellular Carrier", "IP Address", push token (FCM/APNs); dữ liệu phiên (first/last session, session count, total usage duration), trạng thái quyền push. "Location" chỉ khi app bật — **GoGo không bật**. | https://documentation.onesignal.com/docs/data-collected-by-the-onesignal-sdk |
| T2 | Tenjin | "Vendor ID (if available)", "Advertising ID", "IP address", "Device Type, Device Model, Device Locale, Device Country, OS Platform", "OS Version", "Bundle ID, SDK Version, App Version", "Limit Ad Tracking setting", "Apple Search attribution (if enabled)". | https://www.tenjin.com/privacy/ |
| T3 | Sentry | Context thiết bị mặc định của SDK native (`contexts.device/os/app`) vẫn đi: `beforeSend` chỉ dựng lại `user`, `request` và breadcrumb (`sentry.ts:21-31`), không bỏ context. `sendDefaultPii: false` (`sentry.ts:823`); không tracing (`sentry.ts:826`), không screenshot / view hierarchy (`:827-828`); replay **không bao giờ được cấu hình** (không có `mobileReplayIntegration` trong repo). | code + ADR 0010 |
| T4 | Google Maps SDK (`react-native-maps` 1.20.1) | SDK của Google chạy trên **cả hai** nền tảng (`src/shared/ui/map-canvas.view.tsx:95` đặt `provider={maps.PROVIDER_GOOGLE}`, nên iOS cũng không dùng Apple MapKit) — Google nhận API key, thông tin thiết bị/OS/app, IP của người gọi, vùng bản đồ được yêu cầu và toạ độ các marker, tức là **các địa điểm trong kế hoạch của người dùng**. Hai thứ app đã tắt: `showsUserLocation={false}` (`:96`, SDK không đọc GPS) và `toolbarEnabled={false}` (`:97`). Key bơm vào ở `app.config.ts:186` (iOS), `:190` (Android); thiếu key thì build dừng (`:102`). | code + hướng dẫn khai báo của Google cho Maps SDK |
| T5 | Adjust (`react-native-adjust` 5.8.0) | Theo bảng Data Safety của chính Adjust: thu mặc định **App activity** (phiên/lần mở) và **Device or other IDs** — IDFV và IDFA (chỉ khi người dùng cho phép ATT, §12 D-6) trên iOS; GAID (chỉ sau khi người dùng cho phép, §12 D-8) và App Set ID trên Android; **Android ID không đọc** — app gọi `disableAndroidIdReading()` ở mọi trạng thái, `adjust-boundary.test.ts` ghim; thông tin thiết bị/OS/phiên bản SDK, app. IP đi kèm mọi request HTTP. Privacy manifest của pod iOS khai `NSPrivacyTracking = true`, Device ID *linked + tracking* (Analytics, Third-Party Advertising), Product Interaction *not linked*. App **không** gửi event, user id hay PII nào cho Adjust (phase 1, `adjust-boundary.test.ts`). | https://help.adjust.com/en/article/google-play-data-safety ; manifest đọc trong shape `sa-shape-mobile-363-adjust.fable.md` A7 — **đọc lại câu chữ trên trang của Adjust trước khi nộp** |

**Lệch giữa hai nền tảng, có chủ ý và phải khai khác nhau:**

- **Android thu ba định danh, không phải một.** Build khai `com.google.android.gms.permission.AD_ID`
  (`plugins/with-tenjin-android.js:23`) và thêm `play-services-ads-identifier` (`:6`),
  `play-services-appset` (`:7` — App Set ID) và `installreferrer` (`:8` — Install Referrer của Play).
  Đo thật trên APK đã build, không phải suy từ dependency: `docs/tenjin-android-verification-2026-09-08.md:31-34,41,44`
  ghi `AdvertisingIdClient`, `AppSet`, `InstallReferrerClient` có trong APK, `AD_ID: granted=true`, một GAID
  khác 0 đọc được và `connect` trả `{"code":200}`. **Android ID không đọc:** app gọi `disableAndroidIdReading()`
  ở mọi trạng thái (`adjust-boundary.test.ts` ghim danh sách lệnh cấu hình; owner 2026-11-03, #404 Q3).
- **Android chạy SDK từ lúc mở app, mã quảng cáo chờ đồng ý (từ #404, §12 D-8, thay D-7).** Không có quyền hệ điều
  hành nào cho việc này, nên GoGo tự hỏi. Tenjin và Adjust khởi động ở mọi lần mở
  (`src/shared/acquisition/bootstrap.ts`, `startAndroidSdks`); câu trả lời quyết định gửi gì:

  | Trạng thái | Tenjin | Adjust |
  | --- | --- | --- |
  | Chưa trả lời, để sau, từ chối, công tắc tắt (từ lần mở sau) | App Set ID (`developer_device_id`), IP, thông tin thiết bị, lượt cài đặt / mở app; **không** `advertising_id`, `ad_id_local` | App Set ID, `android_uuid`, IP, thông tin thiết bị, phiên; **không** `gps_adid`, **không** `android_id` |
  | Cho phép | thêm `advertising_id`, `ad_id_local` | thêm `gps_adid`, `gps_adid_src`, `tracking_enabled` |
  | Tắt công tắc trong lần mở mà Adjust đã được phép đọc GAID | giữ mã ngay (`optOutParams`) | không gửi gì tới hết lần mở đó (`disable`), lần mở sau chạy giữ mã |

  Đo bằng log tham số của SDK trên SM-A226B, chưa giải mã gói tin (spike #404, `dev/test-evidence/mobile-404/`,
  workspace). Tenjin vẫn đọc GAID trên máy khi giữ mã, chỉ không gửi đi. Cho phép ở giữa lần mở: Tenjin có mã từ
  `connect` lần mở sau; Adjust cần một tiến trình mới. Install Referrer của Play: cả hai SDK đọc ở mọi trạng thái,
  không có định danh thiết bị.
- **iOS thu IDFA khi người dùng cho phép (từ #366).** App xin ATT qua `expo-tracking-transparency`
  (`src/shared/consent/tracking.ts`, chỗ duy nhất import thư viện), chuỗi `NSUserTrackingUsageDescription` ở
  `app.config.ts` + `locales/{vi,en}.json`. App **không tự đọc** IDFA (`getAdvertisingId` không xuất hiện trong
  `src/` — `tracking-permission.test.ts` ghim); SDK Tenjin tự đọc khi iOS cho phép. Tenjin giữ `connect()` lúc
  khởi động (owner Q8 (a)), nên phiên cài đầu đi với IDFA = 0, IDFA đến Tenjin **từ lần mở thứ hai** sau khi
  đồng ý. Từ chối / hạn chế → không IDFA, Tenjin còn IDFV + IP. Khai **dùng để tracking** (§12 D-6, thay D-1).

**Phía Sentry đã bật sẵn để giảm dữ liệu** (khai báo phải khớp những thứ này, không khai theo mặc định của
SDK): `scrubIPAddresses` bật cho cả ba project và rule Advanced Data Scrubbing `[Remove][Anything] from
[$user.geo.**]` (GoGo-Infra#208, #215) — nên **IP và vị trí suy từ IP không được lưu**. `sensitiveFields` bỏ
`code`. Mọi chuỗi còn lại đi qua `redactText` với thứ tự luật ghim bởi oracle
(`src/shared/observability/__fixtures__/redaction-cases.v1.json`).

Giới hạn của hai khẳng định vừa rồi: **đó là thiết lập trong console Sentry, không có hàng IaC nào ghim** —
ai đổi ở đó thì khai báo này sai mà không có commit nào. Bằng chứng trước/sau: Infra#208 comment 6184688951
(`scrubIPAddresses`), comment của O-215-1 (rule `$user.geo.**`). Và Infra#215 tồn tại đúng vì Sentry từng suy
`user.geo` từ IP kết nối **trong khi** `scrubIPAddresses` đã bật. Kiểm lại cả hai trước mỗi lần nộp.

## 4. Quyền hệ điều hành app xin

| Quyền | Khi nào | Chuỗi hiện cho người dùng |
| --- | --- | --- |
| Vị trí khi dùng app | người dùng chọn "dùng vị trí của tôi" | `app.config.ts:271-274` — nói rõ có đường chọn khu vực thủ công |
| Thư viện ảnh | thêm ảnh đại diện (`src/shared/media/pick-avatar.ts:74`), thêm ảnh check-in (`src/features/active-date/checkin-sheet.view.tsx:73`), đính kèm ảnh cho GoGo AI (`src/features/assistant/pick-images.ts`, #378) | `app.config.ts` `photosPermission` — chuỗi nói cả ba việc (#356, #378). `src/shared/config/__tests__/media-permission.test.ts` buộc mỗi call site có từ khoá mục đích trong chuỗi, nên một call site thứ ba sẽ làm test đỏ thay vì âm thầm ship purpose string thiếu |
| Thông báo | sau khi đăng nhập, trước khi đăng ký subscription | `src/shared/notifications/permission.ts` |
| Theo dõi (App Tracking Transparency, **chỉ iOS**) | màn đầu tiên sau khi đăng nhập / vào phòng khách, sau sheet giải thích; một lần, chỉ khi iOS chưa có câu trả lời; không ở splash, đăng nhập, onboarding; không khoá tính năng nào (`src/shared/consent/tracking-consent-gate.tsx`) | plugin `expo-tracking-transparency` trong `app.config.ts` + `locales/vi.json`, `locales/en.json` — câu chữ owner duyệt 2026-10-19 (#366); `tracking-permission.test.ts` buộc ba chỗ bằng nhau và bằng key `consent.tracking.systemPrompt` |
| Theo dõi (**Android, GoGo tự hỏi — không phải quyền hệ điều hành**) | cùng thời điểm với sheet iOS; một lần mỗi lần mở cho tới khi có câu trả lời; "Cho phép" / "Không cho phép", chạm ngoài hoặc back là để sau; không khoá tính năng nào (`src/shared/consent/tracking-consent-gate.tsx`); đổi lại ở Cài đặt → Quyền và dữ liệu (`src/features/settings/tracking-consent.view.tsx`) | `consent.tracking.android.*` trong `src/shared/i18n/{vi,en}.ts` — câu chữ owner duyệt 2026-11-03 (#404, Q1), phiên bản `android-consent-v2` lưu cùng câu trả lời; danh sách dữ liệu và hai bên nhận ở `permissionsSettings.trackingSwitch`, `trackingDetail` (§12 D-8) |

Không xin: vị trí nền, camera, danh bạ, lịch, micro.

## 5. Xoá tài khoản và xuất dữ liệu

- Xoá tài khoản **trong app** — đường người dùng bấm được, không chỉ endpoint:
  `src/features/account/account.view.tsx:186-209` (hộp thoại xác nhận, `deleteAccount()` ở `:201`) →
  `src/shared/providers/session-provider.tsx:122-123` → `src/shared/api/endpoints/sessions.ts:56`. Theo
  ADR-0023 là xoá mềm với danh sách lưu giữ có tên (đánh giá và ảnh đã góp vẫn ở lại). Apple bắt buộc có
  đường xoá trong app: **có**.
- Xuất dữ liệu: `src/features/account/account.view.tsx:173-184` (`exportMyData()` ở `:177`, trả qua share
  sheet ở `:178`) → `src/shared/api/endpoints/sessions.ts:61`.
- Play có mục khai "deletion request": trả lời **có đường xoá trong app**. Nhưng Play còn đòi **một URL web
  để yêu cầu xoá dữ liệu** cho app có tạo tài khoản — URL đó **chưa tồn tại**, cùng trang còn thiếu với Q4
  (namnh92/GoGo-FE#3). Đây là cổng chặn nộp thứ hai, không phải ghi chú bên lề.

## 6. Mapping sang Apple privacy nutrition labels

Ba câu hỏi Apple hỏi mỗi loại dữ liệu: *mục đích*, *có liên kết danh tính*, *có dùng để tracking*. Định
nghĩa tracking của Apple (dẫn nguyên văn): "linking data collected from your app about a particular end-user
or device … with Third-Party Data for targeted advertising or advertising measurement purposes, or sharing
data collected from your app about a particular end-user or device with a data broker"
(https://developer.apple.com/app-store/app-privacy-details/).

| Loại · loại con | Thu | Mục đích | Liên kết danh tính | Tracking | Dẫn từ |
| --- | --- | --- | --- | --- | --- |
| Contact Info · Email Address | có | App Functionality | có | không | D1 |
| Contact Info · Name | có | App Functionality | có | không | D3 |
| Location · Precise Location | có | App Functionality | có | không | D10 |
| User Content · Photos or Videos | có | App Functionality | có | không | D5, D6 |
| User Content · Other User Content | có | App Functionality | có | không | D8, D9, D17, D23 |
| Search History | có | App Functionality | có | không | D11 |
| Identifiers · User ID | có | App Functionality | có | không | D13, D15, D19 |
| Identifiers · Device ID | có | App Functionality, Analytics, Developer's Advertising or Marketing, Third-Party Advertising | có | **có** (§12 D-6) | D12, D14, D16, D24, T1, T2, T4, T5 |
| Usage Data · Product Interaction | có | App Functionality, Analytics | có | không | D18, D20, D21, D22 (chức năng); T1 (dữ liệu phiên), D14, D24, T5 (Analytics) |
| Usage Data · Advertising Data | có | Analytics, Developer's Advertising or Marketing | có | **có** (§12 D-6) | D14, D24, T2, T5 |
| Diagnostics · Crash Data | có | App Functionality | có | không | D15, D16 |
| Diagnostics · Other Diagnostic Data | có | App Functionality | có | không | T3 (context thiết bị của SDK Sentry), T4 |
| Financial Info · Other Financial Info | có (§12 D-3) | App Functionality | có | không | D7, D17 (ngân sách tự đặt), D23 (khoảng giá tự khai) |
| Other Data | có | App Functionality | có | không | D4 (Apple không có loại con cho ngày sinh) |

Không thu, khai "No": Health & Fitness, Financial Info (Payment/Credit), Sensitive Info, Contacts, Browsing
History, Purchases, Surroundings, Body, Diagnostics · Performance Data (không bật tracing — `sentry.ts:826`).

Ghi chú: **cả hai** form đều không có loại dữ liệu cho mật khẩu (D2), nên D2 không xuất hiện ở §6 và §7.
Đó là đúng form, không phải thiếu khai.

Ghi chú về Sensitive Info: hợp đồng có `dietaryKeys`, `accessibilityKeys` và `originText`
(`openapi/gogo.v1.yaml:10516,10557,10560`) nhưng **app không gửi trường nào trong ba trường đó hôm nay**, nên
"Sensitive Info — No" đứng được. Một màn gửi `accessibilityKeys` sẽ làm câu trả lời đó sai (danh sách
Sensitive Info của Apple có khuyết tật) — kiểm lại dòng này mỗi lần nộp.

## 7. Mapping sang Google Play Data safety

Mỗi loại Play hỏi: *thu / chia sẻ*, *xử lý tạm thời*, *bắt buộc hay người dùng chọn*, *mục đích*. "Chia sẻ"
của Play **không** tính việc chuyển cho nhà cung cấp xử lý theo uỷ quyền — vì vậy OneSignal và Sentry khai
"thu, không chia sẻ". **Tenjin khai là bên thứ ba nhận dữ liệu chia sẻ** (owner chốt 2026-10-17, §12 D-2),
nên hai dòng mang dữ liệu Tenjin trả lời "có chia sẻ" kèm mục đích chia sẻ riêng — Play hỏi mục đích thu và
mục đích chia sẻ thành hai câu khác nhau.

| Loại · loại con | Thu | Chia sẻ | Tạm thời | Bắt buộc | Mục đích | Dẫn từ |
| --- | --- | --- | --- | --- | --- | --- |
| Location · Precise location | có | không | không | người dùng chọn | App functionality | D10 |
| Personal info · Email address | có | không | không | bắt buộc (tài khoản) | Account management | D1 |
| Personal info · Name | có | không | không | bắt buộc (tài khoản) | App functionality, Account management | D3 |
| Personal info · User IDs | có | không | không | bắt buộc | App functionality | D13, D15, D19 — cả ba đích là nhà cung cấp xử lý theo uỷ quyền; **Tenjin không nhận id người dùng** (`grep -ri -e customerUserId -e setCustomer -e sendEvent src/shared/acquisition` rỗng; ranh giới ghi ở `initialize.ts:20`), nên Q2 không chi phối dòng này |
| Personal info · Other info | có | không | không | người dùng chọn | App functionality | D4 |
| Financial info · Other financial info | có (§12 D-3) | không | không | người dùng chọn | App functionality | D7, D17, D23 |
| Photos and videos · Photos | có | không | không | người dùng chọn | App functionality | D5, D6 |
| App activity · App interactions | có | **có** — Tenjin (§12 D-2), Adjust (§12 D-5); OneSignal và GoGo BE không tính là chia sẻ | không | bắt buộc | thu: App functionality, Analytics · **chia sẻ: Analytics, Advertising/marketing** | D18, D20, D21, D22; T1, D14, D24, T5 |
| App activity · In-app search history | có | không | không | người dùng chọn | App functionality | D11 |
| App activity · Other user-generated content | có | không | không | người dùng chọn | App functionality | D8, D9, D17, D23 |
| App info and performance · Crash logs | có | không | không | bắt buộc | App functionality, Fraud prevention/security | D15 |
| App info and performance · Diagnostics | có | không | không | bắt buộc | App functionality | D16, T3, T4 |
| Device or other IDs | có | **có** — Tenjin (§12 D-2), Adjust (§12 D-5) | không | bắt buộc | thu: App functionality, Advertising/marketing · **chia sẻ: Analytics, Advertising/marketing** | D12, D14, D16, D24, T1, T2, T4, T5 — gồm App Set ID (Tenjin, Adjust; luôn gửi) và GAID (Tenjin, Adjust; chỉ sau khi cho phép, §3, §12 D-8); **không** có Android ID |

Hai dòng Tenjin/Adjust ở trên vẫn là "bắt buộc" (§12 D-8): App Set ID và lượt cài đặt / mở app đi ở mọi trạng thái,
giữ GAID không làm cả loại thành tuỳ chọn; OneSignal và Sentry vẫn cần `Device or other IDs`, GoGo BE vẫn cần
`App interactions`, mà một dòng là bắt buộc khi bất kỳ đích nào cần nó (owner 2026-11-02, Q3).

Mật khẩu (D2) không có loại tương ứng ở Play, như ở Apple — xem ghi chú cuối §6.

Không thu, khai "No": Health and fitness, Messages, Audio files, Files and docs, Calendar, Contacts, Web
browsing (`expo-image-picker` chỉ nhận `mediaTypes: ['images']` — `src/shared/media/pick-avatar.ts:78`, nên
không có audio và không có file).

Hai câu khai an ninh của Play: **mã hoá khi truyền** — có, **có điều kiện, xem §1** (cơ sở là giá trị prod +
mặc định nền tảng, phải xác nhận trên manifest của bản release); **có cơ chế yêu cầu xoá dữ liệu** — có trong
app (§5), nhưng URL web mà Play đòi thì chưa có (§5, §8).

## 8. Metadata listing

| Mục | Giá trị | Nguồn / ghi chú |
| --- | --- | --- |
| Tên app (bản prod) | `GoGo` | `app.config.ts:25` (`NAMES.prod`) |
| Bundle id / package | `max.gogo.prod` | `app.config.ts:67` |
| Ngôn ngữ mặc định của listing | Tiếng Việt | mặc định sản phẩm (AGENTS.md) |
| Mô tả ngắn (Play, ≤ 80 ký tự) | "Chốt chỗ đi chơi cùng nhau: cùng chọn, cùng bỏ phiếu, có lịch trình." (68) | giới hạn 80 ký tự: https://support.google.com/googleplay/android-developer/answer/9866151 |
| Mô tả dài | bản nháp ở §9 | giới hạn số ký tự: đọc trực tiếp trên console khi điền (trang hỗ trợ không in số) — `CẦN XÁC NHẬN` |
| URL chính sách quyền riêng tư | **chưa có** | GoGo-FE không có trang nào về quyền riêng tư (`grep -i privacy GoGo-FE/src` = rỗng) → namnh92/GoGo-FE#3, **Q4** |
| Từ khoá (App Store, ≤ 100 ký tự, phân tách bằng dấu phẩy) | **CẦN XÁC NHẬN** — owner chốt chữ | không lặp tên app; Play không có ô này |
| URL yêu cầu xoá dữ liệu (Play) | **chưa có** | cùng trang GoGo-FE với Q4 → namnh92/GoGo-FE#3 |
| Email hỗ trợ | namnh@gogo.id.vn | miền của sản phẩm (`GoGo-FE/src/strings.mjs:7`) |
| Ảnh chụp màn hình iOS | bắt buộc ≥ 1 ảnh cho iPhone màn Dynamic Island: 1179 × 2556 (dọc), chấp nhận 1206 × 2622; nếu listing có iPad thì ≥ 1 ảnh iPad 13": 2064 × 2752 hoặc 2048 × 2732. Tối đa 10 ảnh/kích cỡ, `.png`/`.jpg`, không alpha. | https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/ |
| Ảnh và icon Play | icon 512 × 512 PNG 32-bit có alpha (≤ 1024 KB); feature graphic 1024 × 500 JPEG hoặc PNG 24-bit không alpha; ≥ 2 ảnh chụp, cạnh 320–3840 px, cạnh lớn ≤ 2× cạnh nhỏ; nên ≥ 4 ảnh ở ≥ 1080 px để đủ điều kiện quảng bá. | https://support.google.com/googleplay/android-developer/answer/9866151 |
| Phân loại độ tuổi | app có **nội dung do người dùng tạo** (đánh giá, ảnh, ghi chú) và **chia sẻ vị trí trong nhóm** — hai câu hỏi đều phải trả lời "có". Có kiểm duyệt: đánh giá vào trạng thái `pending` trước khi hiện (`openapi/gogo.v1.yaml:12657-12660`), check-in có `moderation` (`:13105`). | OAS |

## 9. Bản nháp mô tả (tiếng Việt, cần owner duyệt chữ)

> **GoGo — chốt chỗ đi chơi, không còn "đâu cũng được".**
>
> Tạo một phòng, mời người đi cùng, mỗi người chọn kiểu chỗ mình thích. GoGo tìm điểm chung, đưa ra lịch
> trình theo ngân sách và thời gian của cả nhóm, rồi đi cùng bạn trong buổi hẹn: từng điểm dừng, đường đi,
> chi tiêu thực tế.
>
> - Cùng chọn: mỗi người vuốt chọn riêng, GoGo lo phần ghép.
> - Bỏ phiếu khi cả nhóm chưa thống nhất; chủ phòng chốt.
> - Lịch trình theo ngân sách: tổng hoặc theo đầu người, không bao giờ lẫn đơn vị.
> - Khoá điểm đã chốt: tạo lại lịch trình vẫn giữ nguyên.
> - Đi chơi xong: ghi lại chi tiêu, đánh giá nơi đã đến.
>
> Khách được mời không cần tạo tài khoản mới vào xem được phòng.

## 10. Câu hỏi còn mở (owner quyết, một số cần ý kiến pháp lý)

Ba câu Q1–Q3 đã được chốt ngày 2026-10-17 và chuyển xuống §12. Còn lại bốn câu:

| # | Câu hỏi | Vì sao nó chặn | Khuyến nghị |
| --- | --- | --- | --- |
| Q4 | Trang chính sách quyền riêng tư **và** trang yêu cầu xoá dữ liệu: ai viết nội dung, đặt ở đâu? | Cả hai cửa hàng **bắt buộc** URL chính sách, và Play còn đòi URL yêu cầu xoá dữ liệu cho app có tạo tài khoản; thiếu một trong hai thì không nộp được. GoGo-FE hiện không có trang nào; đã mở namnh92/GoGo-FE#3. | Trang tĩnh trên gogo.id.vn (GoGo-FE), nội dung dựng từ tài liệu này + ADR-0023; phần pháp lý cần người có thẩm quyền ký. |
| Q5 | Ngày sinh (D4) dùng để làm gì — ý định sản phẩm, không phải sự thật trong repo? | Hiện trạng đo được: **không có cổng tuổi** ("No minimum age applies", `openapi/gogo.v1.yaml:403`) và không consumer nào ngoài `/me` + export; app chỉ hiện và sửa nó (`src/features/account/date-of-birth.view.tsx`, `src/shared/api/queries/use-me.ts:38`). Vì vậy §6/§7 khai `App Functionality` theo đúng hiện trạng; câu còn mở là có thêm mục đích nào không. | Nếu chỉ để lọc nội dung theo tuổi / gợi ý thì khai App functionality; nếu dùng để cá nhân hoá thì phải khai thêm Personalization. |
| Q6 | Luật Bảo vệ dữ liệu cá nhân và Nghị định 356 (thay Nghị định 13/2023/NĐ-CP từ 01/01/2026) có coi mã thiết bị (IDFA, GAID, IDFV, App Set ID) là dữ liệu cá nhân và đòi **đồng ý** trước khi gửi cho Tenjin/Adjust **trên cả Android** — nơi không có ATT? | D-6 chỉ trả lời câu hỏi của Apple. Từ D-8, Android gửi App Set ID, IP và dữ liệu thiết bị cho Tenjin, Adjust **trước khi hỏi và cả khi từ chối**; GAID chỉ sau khi cho phép. Nếu luật đòi đồng ý cho các dữ liệu đó, khai báo Play đúng nhưng hành vi có thể trái luật. Chưa ai có thẩm quyền trả lời. | Hỏi người làm pháp lý **trước lần nộp đầu**, cùng lượt privacy review + DPA của Adjust (#367). Owner chịu trách nhiệm theo dõi; câu trả lời ghi thành một dòng có ngày ở §12. D-6 không trả lời câu này. **Về sản phẩm đã trả lời bằng D-8 (§12); ý kiến pháp lý vẫn còn thiếu**: D-8 ghi quyết định của owner, không phải kết luận pháp lý. |
| Q7 | Máy không có tài khoản (GoGo-MobileApp#398): "sheet `device-promotions-v1` + hộp thoại hệ điều hành + bản ghi cục bộ" có đủ làm bản ghi đồng ý theo Luật Bảo vệ dữ liệu cá nhân và Nghị định 356 (thay Nghị định 13/2023/NĐ-CP) không? | Chưa kiểm tra. Bật cờ `push.device_identity.enabled` ở prod cần lệnh riêng của owner (Q8 của shape); DEV và stag được làm | Hỏi ý kiến pháp lý trước khi bật ở prod |

## 11. Cách kiểm tài liệu này (AC-5 của #354)

Đi hết câu hỏi của từng form trên tài liệu, không mở code:

1. Apple: với từng loại trong 16 loại của §6, trả lời được "thu / không thu"; loại nào thu thì có mục đích,
   có câu trả lời liên kết danh tính, có câu trả lời tracking. Mọi ô `Q*` phải được owner chốt trước khi nộp.
2. Play: với từng loại trong 14 loại của §7, trả lời được bốn câu hỏi của Play; hai câu an ninh có câu trả
   lời ở §5 và §1.
3. Listing: §8 đủ để điền tên, mô tả, từ khoá, URL, email, phân loại; ô `CẦN XÁC NHẬN`, Q4 và hai URL còn
   thiếu (chính sách quyền riêng tư, yêu cầu xoá dữ liệu) là phần đã biết, không phải phát hiện lúc nộp.
   Ba câu còn mở là Q4, Q5 và Q6; §6 và §7 không còn ô nào chờ quyết định.
4. Hai khẳng định **có điều kiện**, phải kiểm lại ngay trước mỗi lần nộp vì không có commit nào ghim chúng:
   mã hoá khi truyền (§1 — đọc manifest của bản release) và `scrubIPAddresses` + rule `$user.geo.**` (§3 —
   đọc lại trong console Sentry).
5. Privacy manifest của SDK (§12 D-6): đọc lại `PrivacyInfo.xcprivacy` của từng SDK MMP trong bản build sắp nộp
   (TenjinSDK 1.19.0 khai `NSPrivacyTracking = true`, domain `track.tenjin.com`; Adjust 5.8.0 khai tracking = true
   và tám domain `consent.*.adjust.*` — đổi theo version pod) và privacy report của Xcode —
   mục "Data Used to Track You" của nhãn phải phủ mọi loại report liệt kê dưới tracking.
6. Định danh Android của Adjust (§3, T5): trên APK release sắp nộp, xác nhận bộ định danh Adjust thật sự gửi —
   GAID (chỉ khi đã cho phép) và App Set ID, **không có `android_id`** ở mọi trạng thái — bằng Adjust Testing
   Console hoặc log tham số của SDK, giá trị che.
7. Trước đồng ý trên Android (§12 D-8): trên bản sắp nộp, từ lúc mở tới lúc sheet hiện, khi sheet để yên, sau "Không
   cho phép", và ở lần mở sau khi tắt công tắc: **không có `advertising_id`, `ad_id_local`, `gps_adid`** trong request tới
   Tenjin/Adjust; App Set ID được phép. Cách đo đủ ở GoGo-MobileApp#404 (AC-3). Từ #402 bản release không còn log
   tham số của Tenjin: phần Tenjin đo bằng bản debug cùng commit hoặc bắt gói tin (ADR 0007).

## 12. Quyết định của owner (có ngày, kèm rủi ro đã nhận)

Ghi ở đây thay vì để trong §10, vì một ô khai báo không được treo vào một câu hỏi. Nguồn kèm theo:
`.claude/rules/execution-policy.md` §8 2026-10-17.

**D-9 (2026-11-03, GoGo-MobileApp#398, GoGo-BE ADR-0038) — máy không có session user nhận ưu đãi chung qua định danh
`device:<id>`.** Sheet `device-promotions-v1` hỏi một lần cho mỗi phiên bản câu chữ, cả khi quyền thông báo đã cấp; chưa trả
lời hoặc "Không nhận ưu đãi" thì không có định danh. Công tắc nằm ở Cài đặt → Quyền và dữ liệu, mặc định bật sau "Tiếp tục"
(owner Q5).

- Dữ liệu: push token tới OneSignal; GoGo BE nhận D21a. Không gắn tài khoản. Đăng nhập thì thu hồi định danh và chuyển
  subscription sang `userId`; đăng xuất cấp định danh mới.
- Xoá: khoảng 90 ngày không hoạt động + 1 giờ tới bước dọn provider + 30 ngày; dọn provider lỗi thì giữ tới khi xử lý xong
  (ADR-0038). Không ghi "sau 90 ngày".
- **Cửa sổ lan truyền, nói thẳng.** Tắt công tắc có hiệu lực ở OneSignal khi SDK đẩy `optOut()` lên (offline: khi có mạng lại)
  và ở BE khi báo cáo tới nơi; giữa hai mốc đó một chiến dịch `public` vẫn có thể tới máy. App hiện "Đang tắt…" tới khi BE đọc
  được từ OneSignal là đã tắt. Mất lịch sử (cài lại, xoá dữ liệu app) với định danh cũ còn sống: app đưa định danh vào diện chờ
  thu hồi, `optOut()` + `logout()`, thử xoá phía server tới khi 2xx hoặc GONE (R-17); offline thì subscription cũ có thể còn
  tới lần có mạng sau. Bản ghi cục bộ mất khi gỡ app (`allowBackup: false`).
- Rủi ro mở: Q7 ở §10. M-3 đo được OneSignal có thể báo `enabled=true` cho máy đã cài lại, nên đối tượng thiết bị có thể đếm dư
  tới khi hết hạn.

**D-8 (2026-11-03, GoGo-MobileApp#404, ADR 0014) — Android chạy SDK như iOS, giữ mã quảng cáo tới khi đồng ý; thay
dòng "không SDK nào khởi động trước đồng ý" của D-7.** Tenjin và Adjust khởi động ở mọi lần mở. Chưa trả lời, để sau,
từ chối, công tắc tắt: không gửi GAID; App Set ID, IP, thông tin thiết bị, lượt cài đặt / mở app vẫn gửi (bảng ở §3).
Android ID không đọc ở mọi trạng thái (Q3). Tắt công tắc trong lần mở mà Adjust đã được phép đọc GAID: Tenjin giữ mã
ngay, Adjust không gửi gì tới hết lần mở đó (Q6; `disable()` sống qua lần mở, lần sau `enable()` lại — tiến trình chết
trước `enable()` thì Adjust im tới lần khởi động kế tiếp hoàn tất). Câu chữ đồng nhất hai nền tảng (Q1); sheet không nêu
tên bên nhận và danh sách dữ liệu, hai thứ đó ở Cài đặt → Quyền và dữ liệu. Câu trả lời v1 được hỏi lại
(`android-consent-v2`). §6 không đổi; ô §7 không đổi, chỉ đổi phần giải thích định danh.

> **Rủi ro owner nhận với D-8.** (1) App Set ID, IP và dữ liệu thiết bị đến Tenjin và Adjust **trước khi hỏi và khi từ
> chối**. (2) Luật Bảo vệ dữ liệu cá nhân và Nghị định 356 chưa kiểm tra (§10 Q6 còn mở). (3) Sheet không nêu tên bên
> nhận; chính sách User Data của Play chưa đọc hết. (4) Attribution khi không có GAID chưa kết luận: spike ra `Organic`
> nhưng cài bằng `adb`, không có Install Referrer, không đối chứng; đo trên Play internal track. #397 đóng NOT_PLANNED,
> mở lại nếu đo thấy mất attribution. (5) Adjust khuyên hỏi đại diện trước khi tắt định danh (help.adjust.com), chưa hỏi.

**D-7 (quyết định 2026-10-20, làm 2026-11-02, GoGo-MobileApp#370, ADR 0013; phần "không SDK nào khởi động trước đồng ý",
`optOut()`, câu chữ đã bị D-8 thay) — xin đồng ý trên cả Android; thay dòng
"Android không đổi" của D-6.** Android không có ATT nên GoGo tự hỏi, cùng thời điểm với sheet iOS; không SDK MMP nào
khởi động trước khi người dùng chọn "Cho phép". Từ chối được lưu và đổi lại được ở Cài đặt → Quyền và dữ liệu (tắt:
Tenjin `optOut()`, Adjust `disable()`). Câu chữ owner duyệt 2026-11-02 (Q7) nêu đủ loại dữ liệu, hai bên nhận, mục
đích, cái mất khi từ chối và đường rút lại. iOS không đổi (Q8 (a), Q5). §6 không đổi; §7 giữ "bắt buộc" (Q3).

> **Rủi ro owner nhận với D-7.** (1) Đây là quyết định sản phẩm, **không** phải kết luận pháp lý về Nghị định 13/2023
> — §10 Q6 còn mở. (2) Bằng chứng đồng ý chỉ là **một bản ghi cục bộ**: một câu trả lời kèm phiên bản câu chữ, không
> có lịch sử, mất khi gỡ app. (3) **Rút đồng ý có thể bị đảo ngược một lần:** app bị kill hoặc bộ nhớ hỏng đúng giữa
> lúc rút và lúc ghi xuống đĩa thì lần mở sau đọc lại "Cho phép" và SDK chạy mà không hỏi lại; khi ghi không xong,
> màn Cài đặt báo "Chưa lưu được" nhưng dấu đó không sống qua lần tắt app. Không dựng cơ chế khôi phục vì nó hỏng cùng
> bộ nhớ (Astra A-F-02). (4) Người từ chối trên Android không có deferred link (Q4, đường không định danh ở #397).
> (5) Trên Android, lượt cài chỉ được báo sau đăng nhập **và** đồng ý: số cài trên dashboard thấp hơn và trễ hơn.
> **Rollback không quay về khởi động vô điều kiện** (ADR 0013): gỡ tính năng nghĩa là tắt acquisition Android và giữ
> nguyên câu trả lời đã lưu.

**D-4 (2026-10-20) — Adjust trên iOS dùng chung câu hỏi ATT của GoGo (D-6), không tự hỏi.** SDK chỉ chờ tối đa
60 s câu trả lời trước gói đầu tiên (`setAttConsentWaitingInterval(60)`); không gọi
`requestAppTrackingAuthorization`, không tắt ATT/IDFA. Privacy manifest của pod khai tracking = true và Device ID
*Third-Party Advertising* — §6 đã khai theo. Đọc lại manifest mỗi lần nộp (§11 bước 5).

> **Rủi ro.** Chưa có privacy review cho Adjust và chưa ghi ngày owner chấp nhận DPA/điều khoản trong dashboard
> Adjust — **cổng trước lượt chạy máy đầu tiên có token thật** (owner Q5, 2026-10-19); lượt review đó kiểm luôn
> bộ định danh Android của Adjust, gồm Android ID (§3, §11 bước 6). Xoá tài khoản (ADR-0023)
> không lan tới Adjust (như Tenjin): `gdprForgetMe()` theo thiết bị, chưa nối vào luồng xoá — giới hạn đã biết.

**D-5 (2026-10-20) — Adjust khai là bên thứ ba nhận dữ liệu chia sẻ trên Play** — cùng lý do D-2: khai thừa không
bị phạt. Áp cho §7 `App activity · App interactions` và `Device or other IDs`. Đổi thành "xử lý theo uỷ quyền" chỉ
khi DPA của Adjust nói rõ.

**D-6 (2026-10-19) — thay D-1: xin ATT trên iOS, IDFA cho các SDK MMP khi được phép, khai "dùng để tracking".**
Owner chốt Q1 (b) của shape `dev/handoffs/sa-shape-mobile-363-adjust.fable.rev2.md` (GoGo-MobileApp#363/#366;
`.claude/rules/execution-policy.md` §8 2026-10-19). Đi đúng đường Apple chấp nhận mà dòng rủi ro của D-1 nêu: màn
ATT **trước**, rồi nhãn đổi. Hệ quả: §6 `Identifiers · Device ID` và `Usage Data · Advertising Data` khai
tracking = có, mục "Data Used to Track You" của App Store liệt kê hai loại đó; §4 thêm quyền Theo dõi. Android
không đổi **(đã bị D-7 rồi D-8 thay: Android nay tự hỏi, SDK chạy từ lúc mở app, mã quảng cáo chờ đồng ý)** (không có ATT; GAID, App Set ID và `AD_ID` như §3, D-2 đã khai chia sẻ; Android ID của Adjust theo D-5). Câu chữ hộp thoại do owner duyệt
(#366, 2026-10-19).

> **Rủi ro owner nhận với D-6.** Tỉ lệ người dùng đồng ý chưa có số đo; chất lượng attribution iOS phụ thuộc
> vào nó. Người từ chối vẫn được đo nhưng không IDFA (IDFV, IP, SKAdNetwork). Tenjin chỉ nhận IDFA từ lần mở
> thứ hai (Q8 (a)). Câu hỏi pháp lý về Nghị định 13/2023 trên **cả Android** chưa ai trả lời — §10 Q6; D-6
> không trả lời nó.
>
> **Rollback không kéo khai báo về D-1** (ADR 0012 §Rollback): gỡ màn ATT không thu lại "Cho phép" đã cấp, và
> SDK còn trong binary vẫn đọc IDFA. D-6 đứng tới khi mọi SDK đọc IDFA bị gỡ hoặc tắt và đã kiểm trên privacy
> report của bản nộp.

**D-1 (2026-10-17) — đã bị D-6 thay ngày 2026-10-19; giữ nguyên văn làm lịch sử.** Tenjin trên iOS: giữ
không-IDFA, khai "không dùng để tracking". Hiện trạng đo được lúc đó:
không có `expo-tracking-transparency` trong `package.json`, không có `NSUserTrackingUsageDescription` trong
`app.config.ts`, nên không có màn ATT và iOS không cấp IDFA; Tenjin chỉ nhận IDFV + IP (§3, T2).

> **Rủi ro owner đã nhận, không được xoá dòng này.** Không-IDFA *không* đồng nghĩa không-tracking: đối sánh
> install theo IP cộng tín hiệu thiết bị là fingerprinting theo hướng dẫn ATT của Apple và bị cấm bất kể nhãn
> khai. Đường Apple chấp nhận là SKAdNetwork / AdAttributionKit. Nếu marketing cần IDFA, hoặc nếu App Review
> chất vấn, quyết định này phải mở lại — khi đó cần màn ATT **trước**, và nhãn đổi sang "dùng để tracking".

**D-2 (2026-10-17) — Tenjin khai là bên thứ ba nhận dữ liệu chia sẻ trên Play.** An toàn hơn khi chưa ai đọc
DPA của Tenjin: khai thừa một quan hệ chia sẻ không bị phạt, khai thiếu thì bị. Áp cho hai dòng của §7
(`App activity · App interactions`, `Device or other IDs`), kèm mục đích chia sẻ `Analytics,
Advertising/marketing`. Đổi lại thành "xử lý theo uỷ quyền" **chỉ khi** DPA của Tenjin nói rõ quan hệ đó —
đọc DPA là việc còn nợ, không phải điều kiện chặn nộp.

**D-3 (2026-10-17) — số tiền người dùng tự nhập khai vào Financial info (`other financial info`), cả hai
form.** Ba chỗ: hoá đơn check-in (D7), ngân sách phòng tự đặt (D17), khoảng giá khi góp địa điểm (D23). Không
phải thông tin thanh toán, nhưng là số tiền do người dùng nhập; khai thừa không bị phạt, khai thiếu thì bị.
