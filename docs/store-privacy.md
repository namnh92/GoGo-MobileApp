# Khai báo dữ liệu cho App Store và Google Play

**Trạng thái:** nguồn duy nhất để điền hai form khai báo (Apple privacy nutrition labels, Google Play Data
safety) và phần metadata listing. Đọc trên `develop` ngày 2026-10-17 (GoGo-MobileApp#354, tách từ #21
APP-010).

Luật của tài liệu: **mỗi dòng dữ liệu phải dẫn được tới nơi code thật gửi nó** (`file:line`), tới hàng cấu
hình, hoặc tới tài liệu nhà cung cấp. Dòng nào không dẫn được thì ghi `CẦN XÁC NHẬN`, không suy đoán — một
khai báo sai là lý do bị từ chối bản nộp hoặc bị gỡ khỏi cửa hàng, không phải một lỗi chữ.

## 1. Bốn đích dữ liệu

| Đích | Vai trò | Quan hệ |
| --- | --- | --- |
| GoGo BE (`https://api-*.gogo.id.vn/v1`) | máy chủ của chính sản phẩm | của GoGo |
| OneSignal | gửi push | nhà cung cấp xử lý theo uỷ quyền |
| Tenjin | đo nguồn cài đặt (attribution) | **xem Q2** — xử lý theo uỷ quyền hay bên thứ ba |
| Sentry | crash/error + session release-health | nhà cung cấp xử lý theo uỷ quyền |

Truyền qua HTTPS: `EXPO_PUBLIC_API_URL` được validate là URL (`src/shared/config/env.ts:10`) và mẫu dùng
`https://api-dev.gogo.id.vn/v1` (`.env.example:12`). Bản nộp cửa hàng phải trỏ `https` của prod — đó là một
dòng kiểm trong lane build (#350, #351).

Không có SDK analytics nào: `track()` chỉ `console.debug` tại máy, không gửi đi đâu
(`src/shared/analytics/index.ts:56-58`). Token phiên nằm trong Keychain/Keystore, không gửi cho ai
(`src/shared/storage/secure-store.ts:3,8`).

## 2. Dữ liệu app tự gửi

| # | Dữ liệu | Code gửi | Đích | Mục đích | Gắn danh tính | Bắt buộc |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Email | `openapi/gogo.v1.yaml:236` (register), `:270` (login); `src/shared/api/endpoints/sessions.ts:17,22` | GoGo BE | tạo và đăng nhập tài khoản | có | bắt buộc khi đăng ký (phiên khách không cần) |
| D2 | Mật khẩu | `openapi/gogo.v1.yaml:237,271` | GoGo BE | xác thực | có | như D1 |
| D3 | Tên hiển thị | `openapi/gogo.v1.yaml:238` | GoGo BE | hồ sơ, hiển thị trong phòng | có | bắt buộc khi đăng ký |
| D4 | Ngày sinh | `src/shared/api/queries/use-me.ts:38`, `endpoints/sessions.ts:52` | GoGo BE | xem Q5 | có | tuỳ chọn |
| D5 | Ảnh đại diện | `src/shared/media/pick-avatar.ts:59,65` → `src/shared/api/queries/use-uploads.ts:46-58` → `endpoints/profile.ts:10` | GoGo BE + object storage (PUT presigned) | hồ sơ | có | tuỳ chọn |
| D6 | Ảnh check-in (≤ 3) và ảnh hoá đơn | `openapi/gogo.v1.yaml:2969,2978` (`photoKeys`, `billPhotoKey`); cùng đường upload D5 | GoGo BE + object storage | nội dung người dùng, đối chứng chi tiêu | có | tuỳ chọn |
| D7 | Số tiền hoá đơn tự khai, số người | `openapi/gogo.v1.yaml:2973,2977` (`billTotal`, `billPeopleCount`, request của check-in) | GoGo BE | chia tiền, đối chiếu ngân sách | có | tuỳ chọn |
| D8 | Đánh giá: điểm + nội dung chữ | `openapi/gogo.v1.yaml:12648-12660`; `endpoints/me.ts:24,32` | GoGo BE | nội dung người dùng, kiểm duyệt | có | tuỳ chọn |
| D9 | Ghi chú và tag của check-in | `openapi/gogo.v1.yaml:2964,2968` (`tags`, `note`) | GoGo BE | nội dung người dùng | có | tuỳ chọn |
| D10 | Toạ độ chính xác | lấy: `src/shared/location/fresh-position.ts`, `use-current-location.ts`; gửi: `src/features/search/search.view.tsx:133-134`, `src/features/create-date/create-location.view.tsx:82`, `src/shared/administrative/queries.ts:44` | GoGo BE | gợi ý địa điểm gần, suy ra khu vực hành chính | có (gắn phiên) | tuỳ chọn — có đường chọn khu vực thủ công, chuỗi quyền nói đúng điều đó (`app.config.ts:271-274`) |
| D11 | Truy vấn tìm kiếm địa điểm | `src/features/search/search.view.tsx` (tham số truy vấn) | GoGo BE | tìm kiếm | có | tuỳ chọn |
| D12 | Id đăng ký push + nền tảng | `src/shared/api/endpoints/me.ts:97`; `openapi/gogo.v1.yaml:3170-3205` | GoGo BE | biết người dùng còn nhận được thông báo không | có | tuỳ chọn (theo quyền thông báo) |
| D13 | `external_id` = `users.id` + token ES256 ngắn hạn | `src/shared/notifications/identity-session.ts:23,133`; token lấy ở `identity-api.ts:21` | OneSignal | định danh thiết bị để gửi push đúng người | có | tuỳ chọn |
| D14 | Sự kiện cài đặt / mở app + tham số attribution | `src/shared/acquisition/bootstrap.ts:11-12`, `initialize.ts:21-30`, `deferred-link.ts:36` | Tenjin | đo nguồn cài đặt, mở deferred deep link | gắn định danh thiết bị (xem T2 §3) | tuỳ chọn |
| D15 | Crash, lỗi, breadcrumb đã lọc | `src/shared/observability/sentry.ts:733` (`beforeSend`), `:699` (`beforeBreadcrumb`), `:823-845` | Sentry | sửa lỗi | `user.id` = id người dùng khi đã đăng nhập, ngược lại là installation id của SDK native (`sentry.ts:16-19`, ADR 0010) | tuỳ chọn theo DSN của bản build |
| D16 | Session release-health (`sid`, `did`, status, counters, `seq`) | `src/shared/observability/sentry.ts:14-19,825` | Sentry | tỉ lệ crash-free | `did` = installation id native, **không** phải id người dùng | như D15 |

Không gửi: danh bạ, lịch, tin nhắn, sức khoẻ, thông tin thanh toán, mật khẩu của bên thứ ba, vị trí nền
(`app.config.ts:275-276` tắt cả hai nền tảng).

## 3. Dữ liệu SDK thứ ba tự thu (phải khai dù app không viết dòng nào)

| # | SDK | Nhà cung cấp nói nó thu gì | Nguồn |
| --- | --- | --- | --- |
| T1 | OneSignal | "Device OS", "Device Language", "Timezone", "Country", "App Version", "Device Model", "Application Identifier", "Cellular Carrier", "IP Address", push token (FCM/APNs); dữ liệu phiên (first/last session, session count, total usage duration), trạng thái quyền push. "Location" chỉ khi app bật — **GoGo không bật**. | https://documentation.onesignal.com/docs/data-collected-by-the-onesignal-sdk |
| T2 | Tenjin | "Vendor ID (if available)", "Advertising ID", "IP address", "Device Type, Device Model, Device Locale, Device Country, OS Platform", "OS Version", "Bundle ID, SDK Version, App Version", "Limit Ad Tracking setting", "Apple Search attribution (if enabled)". | https://www.tenjin.com/privacy/ |
| T3 | Sentry | Context thiết bị mặc định của SDK native (`contexts.device/os/app`) vẫn đi: `beforeSend` chỉ dựng lại `user`, `request` và breadcrumb (`sentry.ts:21-31`), không bỏ context. `sendDefaultPii: false` (`sentry.ts:823`), không tracing / replay / screenshot (`sentry.ts:826-827`). | code + ADR 0010 |

**Lệch giữa hai nền tảng, có chủ ý và phải khai khác nhau:**

- **Android thu advertising ID (GAID).** Build khai `com.google.android.gms.permission.AD_ID`
  (`plugins/with-tenjin-android.js:23`) và thêm `play-services-ads-identifier` (`:6`).
- **iOS không thu IDFA.** Repo không có `expo-tracking-transparency` (`package.json`) và không có
  `NSUserTrackingUsageDescription` trong `app.config.ts`, nên không có màn ATT — không có ATT thì iOS không
  cấp IDFA; Tenjin chỉ còn IDFV + IP. Hệ quả cho khai báo: xem **Q1**.

**Phía Sentry đã bật sẵn để giảm dữ liệu** (khai báo phải khớp những thứ này, không khai theo mặc định của
SDK): `scrubIPAddresses` bật cho cả ba project và rule Advanced Data Scrubbing `[Remove][Anything] from
[$user.geo.**]` (GoGo-Infra#208, #215) — nên **IP và vị trí suy từ IP không được lưu**. `sensitiveFields` bỏ
`code`. Mọi chuỗi còn lại đi qua `redactText` với thứ tự luật ghim bởi oracle
(`src/shared/observability/__fixtures__/redaction-cases.v1.json`).

## 4. Quyền hệ điều hành app xin

| Quyền | Khi nào | Chuỗi hiện cho người dùng |
| --- | --- | --- |
| Vị trí khi dùng app | người dùng chọn "dùng vị trí của tôi" | `app.config.ts:271-274` — nói rõ có đường chọn khu vực thủ công |
| Thư viện ảnh | thêm ảnh check-in, ảnh đại diện | `app.config.ts:264-266` |
| Thông báo | sau khi đăng nhập, trước khi đăng ký subscription | `src/shared/notifications/permission.ts` |

Không xin: vị trí nền, camera, danh bạ, lịch, micro.

## 5. Xoá tài khoản và xuất dữ liệu

- Xoá tài khoản **trong app**: `src/shared/api/endpoints/sessions.ts:56` (`DELETE`), theo ADR-0023 — xoá mềm
  với danh sách lưu giữ có tên (đánh giá và ảnh đã góp vẫn ở lại). Apple bắt buộc có đường xoá trong app:
  **có**.
- Xuất dữ liệu: `src/shared/api/endpoints/sessions.ts:61`.
- Play có mục khai "deletion request": trả lời **có đường xoá trong app**; đường xoá qua web chưa tồn tại —
  cùng khoảng trống với Q4.

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
| User Content · Other User Content | có | App Functionality | có | không | D8, D9 |
| Search History | có | App Functionality | có | không | D11 |
| Identifiers · User ID | có | App Functionality | có | không | D13, D15 |
| Identifiers · Device ID | có | App Functionality, Analytics | có | **Q1** | D12, D14, D16, T1, T2 |
| Usage Data · Product Interaction | có | Analytics | có | không | T1 (dữ liệu phiên), D14 |
| Usage Data · Advertising Data | có | Analytics | có | **Q1** | D14, T2 |
| Diagnostics · Crash Data | có | App Functionality | có | không | D15, D16 |
| Financial Info · Other Financial Info | **Q3** | App Functionality | có | không | D7 |
| Other Data | có | App Functionality | có | không | D4 (Apple không có loại con cho ngày sinh) |

Không thu, khai "No": Health & Fitness, Financial Info (Payment/Credit), Sensitive Info, Contacts, Browsing
History, Purchases, Surroundings, Body, Diagnostics · Performance Data (không bật tracing — `sentry.ts:826`).

Ghi chú: Apple không có loại dữ liệu cho **mật khẩu** (D2), nên D2 không xuất hiện trong form. Đó là đúng
form, không phải thiếu khai.

## 7. Mapping sang Google Play Data safety

Mỗi loại Play hỏi: *thu / chia sẻ*, *xử lý tạm thời*, *bắt buộc hay người dùng chọn*, *mục đích*. "Chia sẻ"
của Play **không** tính việc chuyển cho nhà cung cấp xử lý theo uỷ quyền — vì vậy OneSignal và Sentry khai
"thu, không chia sẻ"; Tenjin là **Q2**.

| Loại · loại con | Thu | Chia sẻ | Tạm thời | Bắt buộc | Mục đích | Dẫn từ |
| --- | --- | --- | --- | --- | --- | --- |
| Location · Precise location | có | không | không | người dùng chọn | App functionality | D10 |
| Personal info · Email address | có | không | không | bắt buộc (tài khoản) | Account management | D1 |
| Personal info · Name | có | không | không | bắt buộc (tài khoản) | App functionality, Account management | D3 |
| Personal info · User IDs | có | **Q2** | không | bắt buộc | App functionality | D13, D15 |
| Personal info · Other info | có | không | không | người dùng chọn | App functionality | D4 |
| Financial info · Other financial info | **Q3** | không | không | người dùng chọn | App functionality | D7 |
| Photos and videos · Photos | có | không | không | người dùng chọn | App functionality | D5, D6 |
| App activity · App interactions | có | **Q2** | không | bắt buộc | Analytics | T1, D14 |
| App activity · In-app search history | có | không | không | người dùng chọn | App functionality | D11 |
| App activity · Other user-generated content | có | không | không | người dùng chọn | App functionality | D8, D9 |
| App info and performance · Crash logs | có | không | không | bắt buộc | App functionality, Fraud prevention/security | D15 |
| App info and performance · Diagnostics | có | không | không | bắt buộc | App functionality | D16, T3 |
| Device or other IDs | có | **Q2** | không | bắt buộc | App functionality, Advertising/marketing | D12, D14, D16, T1, T2 |

Hai câu khai an ninh của Play: **mã hoá khi truyền** — có (§1); **có cơ chế yêu cầu xoá dữ liệu** — có, trong
app (§5).

## 8. Metadata listing

| Mục | Giá trị | Nguồn / ghi chú |
| --- | --- | --- |
| Tên app (bản prod) | `GoGo` | `app.config.ts:25` (`NAMES.prod`) |
| Bundle id / package | `max.gogo.prod` | `app.config.ts:67` |
| Ngôn ngữ mặc định của listing | Tiếng Việt | mặc định sản phẩm (AGENTS.md) |
| Mô tả ngắn (Play, ≤ 80 ký tự) | "Chốt chỗ đi chơi cùng nhau: cùng chọn, cùng bỏ phiếu, có lịch trình." (68) | giới hạn 80 ký tự: https://support.google.com/googleplay/android-developer/answer/9866151 |
| Mô tả dài | bản nháp ở §9 | giới hạn số ký tự: đọc trực tiếp trên console khi điền (trang hỗ trợ không in số) — `CẦN XÁC NHẬN` |
| URL chính sách quyền riêng tư | **chưa có** | GoGo-FE không có trang nào về quyền riêng tư (`grep -i privacy GoGo-FE/src` = rỗng) → **Q4** |
| Email hỗ trợ | namnh@gogo.id.vn | miền của sản phẩm |
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

| # | Câu hỏi | Vì sao nó chặn | Khuyến nghị |
| --- | --- | --- | --- |
| Q1 | Tenjin trên iOS: khai "dùng để tracking" + thêm màn ATT, hay giữ không-IDFA và khai "không tracking"? | Đo nguồn cài đặt là "advertising measurement" trong định nghĩa của Apple (§6). Khai tracking mà không có ATT là lệch; khai không-tracking mà có liên kết dữ liệu bên thứ ba cũng lệch. | Giữ không-IDFA (hiện trạng), khai "không tracking", và ghi rõ với Tenjin rằng app không gửi IDFA. Nếu marketing cần IDFA thì phải thêm ATT trước — đó là một issue riêng, không phải một ô trong form. Cần ý kiến pháp lý. |
| Q2 | Trên Play, Tenjin là nhà cung cấp xử lý theo uỷ quyền hay bên thứ ba nhận dữ liệu chia sẻ? | Quyết định ba dòng "chia sẻ" ở §7. | Khai **có chia sẻ** cho Tenjin (an toàn hơn, khó bị coi là khai thiếu), trừ khi hợp đồng/DPA với Tenjin nói rõ quan hệ xử lý theo uỷ quyền. Cần đọc DPA. |
| Q3 | Số tiền hoá đơn tự khai (D7) có khai vào Financial info không? | Hai form đều có ô "other financial info". | **Khai**. Đây là số tiền người dùng nhập, dù không phải thông tin thanh toán; khai thừa không bị phạt, khai thiếu thì bị. |
| Q4 | Trang chính sách quyền riêng tư: ai viết nội dung, đặt ở đâu? | Cả hai cửa hàng **bắt buộc** URL chính sách; không có URL thì không nộp được. GoGo-FE hiện không có trang nào. | Trang tĩnh trên gogo.id.vn (GoGo-FE), nội dung dựng từ tài liệu này + ADR-0023; phần pháp lý cần người có thẩm quyền ký. |
| Q5 | Ngày sinh (D4) dùng để làm gì, khai mục đích nào? | Mục đích khai phải khớp việc dùng thật. | Nếu chỉ để lọc nội dung theo tuổi / gợi ý thì khai App functionality; nếu dùng để cá nhân hoá thì phải khai thêm Personalization. |

## 11. Cách kiểm tài liệu này (AC-5 của #354)

Đi hết câu hỏi của từng form trên tài liệu, không mở code:

1. Apple: với từng loại trong 16 loại của §6, trả lời được "thu / không thu"; loại nào thu thì có mục đích,
   có câu trả lời liên kết danh tính, có câu trả lời tracking. Mọi ô `Q*` phải được owner chốt trước khi nộp.
2. Play: với từng loại trong 14 loại của §7, trả lời được bốn câu hỏi của Play; hai câu an ninh có câu trả
   lời ở §5 và §1.
3. Listing: §8 đủ để điền tên, mô tả, URL, email, phân loại; ô `CẦN XÁC NHẬN` và Q4 là phần còn thiếu đã
   biết, không phải phát hiện lúc nộp.
