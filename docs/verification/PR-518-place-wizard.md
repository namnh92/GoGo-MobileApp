# #518 — Three-step place contribution wizard

Refs #518. Local code, tests and review notes only; no install, commit, push,
PR publication, native build or deployment.

- Branch: `feature/GOGO-518-place-wizard`.
- Stack/base: PR #516, `c01b1ff229205791e35af5391ebdb54c5249451f`.
- Owner instruction dated 2026-11-07 explicitly authorizes implementing #518
  now. This supersedes the #518 deferral in `PR-516-group-03.md` for this task.

## Contract dependency — pre-merge vendor

`openapi/gogo.v1.yaml` is copied verbatim from
`/Users/maxnguyen/MyWorks/GoGo/dev/worktrees/be-796/openapi/gogo.v1.yaml`.
**GoGo-BE#796 is not merged. Re-vendor the merged backend contract and regenerate
`src/shared/api/schema.d.ts` after BE#796 merges. Run `pnpm api:check` again.**
The current vendored SHA256 is
`c9ea74f45097bdb0aeff95efb51a1a45baa8e92d581c38645be27358e5c865d2`.

The client uses generated operation bodies/responses and schema types for:

- `POST /v1/place-submissions`: `enrichment`, with purposes, 1–3 vibes,
  separate service/space ratings, optional price, amenities, dishes and tips.
- `GET /v1/place-contribution-drafts` and `GET /{id}` for explicit resumption.
- `PUT /v1/place-contribution-drafts/{id}` with client UUID and `expectedVersion`.
- `DELETE /v1/place-contribution-drafts/{id}?version=...`.

Drafts contain only the provider identifier and unverified user claims. They
never contain the pasted URL, Google name/address/image, resolution token or
local photo URIs. The query persistence allowlist excludes the private draft
root; draft queries/mutations have zero cache retention after release and no
mutation retries. Conflicts require explicit GET/resume; they never silently
replace newer server data. A lost create response retains its UUID so a retry
cannot create another draft. Saving an existing place draft requires resuming
or deleting it first. Drafts are available only to registered users; guests
retain room-scoped submission behavior.

## Direct Stitch evidence

Read all three exact screens live on 2026-11-07 using the configured read-only
Stitch MCP adapter: `get_screen`, then `download_file` for both HTML and image.
Inspected all three source images and the corresponding HTML. No Stitch writes.

| Step | Project / screen | Source evidence |
| --- | --- | --- |
| 1 | `17315762413421369447` / `10756253768045112131` | Live HTML SHA matches [#516 verified HTML](PR-516-group-03-source/verified.html), with [source image](PR-516-group-03-source/verified.jpg); HTML `files/15752337466060138129`, image `files/17806848170454934078` |
| 2 | Same project / `2fd3b7e365954d6db9ef612d361a1bbf` | [HTML](PR-518-source/step-2.html), [PNG](PR-518-source/step-2.png); screen `fileEntries/html` and `fileEntries/screenshot` |
| 3 | Same project / `3d9ed7f6136a477c85c76057aafff0b4` | [HTML](PR-518-source/step-3.html), [PNG](PR-518-source/step-3.png); screen `fileEntries/html` and `fileEntries/screenshot` |

Step 2 HTML / PNG SHA256:
`cbfe3ed0031f4a45c8e9a1b5d33e65f00cb3e21bb8a134c7e55aa03d22919c0f` /
`12ef21f2682130217c394ff7aaf5765ed971fc2c7540d3b715b05706e1e6794a`.
Step 3 HTML / PNG SHA256:
`c57c64c41a3d88b08f2663b80bfc69b548df4db2941e4ec2dd40f38b145c224e` /
`9c8ee96aceb5481185ce38653dfdf7d71e1689266b5b3ddaa9313b39f92900da`.
Design samples are documentation only and are never imported into app code.

## Sửa theo owner 2026-11-07 — đối chiếu từng phần

Owner sau khi xem simulator: “Phần bổ sung trải nghiệm vẫn không giống Stitch.
Làm giống hoàn toàn. Quá nhiều badge (Chip chọn) làm rối form.”
Owner bổ sung: “Phần ảnh và thông tin ở bước 3 là optional”.
Lệnh sửa #518 hiện tại cho phép sửa file/test trong worktree này, không install,
commit, push hay ghi vào Stitch. Đây là phạm vi được owner cho phép trực tiếp;
không tuyên bố gate migration toàn dự án đã hoàn tất.

Đã đọc lại **trực tiếp** cả ba screen qua cấu hình Stitch MCP có sẵn:
`get_screen` → `download_file` HTML và screenshot, ngày 2026-11-07.
Đã xem đủ ba ảnh và đối chiếu phần wizard với HTML. Hash của HTML bước 2/3 và
ảnh bước 2/3 vẫn đúng bảng trên. HTML bước 1 SHA256:
`c40a37767f55bf96112a7d7b0f67a23b5e255f4ac3e1588f112fe862fec57676`;
ảnh bước 1: `e61bda5d7638299f04d816b807e7ac0a7839ab6a45c0659dca6c800d47f40a47`.

Đọc trực tiếp `GET https://api-dev.gogo.id.vn/v1/taxonomies`, không đăng nhập,
không thay đổi server. Snapshot: [taxonomies-2026-11-07.json](PR-518-source/taxonomies-2026-11-07.json).
Đây là trạng thái DEV tại thời điểm đọc, không phải cam kết taxonomy đã đủ.
Không lấy key từ dữ liệu test hoặc đoán key theo nhãn Stitch.
Nhãn Stitch được dịch bằng i18n vi/en; chỉ hiển thị khi API có key đã mapping
và nhãn dùng được. Thứ tự hiển thị theo Stitch, độc lập thứ tự API trả về.

**MATCH** dưới đây là cấu trúc/control/copy trong code đã đối chiếu source;
không phải kết quả đo pixel trên app. **CHANGED** là chỗ có thay đổi được giải
thích; **HIDDEN** là phần thiếu key hoặc dữ liệu thật, theo lệnh owner.

| Phần tử Stitch | Kết quả app | Trạng thái / lý do | File:dòng |
| --- | --- | --- | --- |
| Card “Bổ sung trải nghiệm thực tế”, icon, pill +50 GoGo Credit | Card riêng; pill chính sách +50, thêm chữ nhỏ “khi được duyệt”; bỏ số dư tài khoản khỏi header | CHANGED — wording theo owner; không thưởng ngay, không sample | `contribution-wizard.view.tsx:319`, `:153` |
| 3 đoạn progress; 1. Giá & Mục đích / 2. Tiện ích & Vibe / 3. Menu & Bill | Đúng thứ tự, màu current/completed, label + trạng thái; không coi bước 3 đã xong chỉ vì optional | MATCH cấu trúc; dùng label bước 2 owner yêu cầu cho cả wizard | `contribution-wizard.view.tsx:331` |
| Nền Light, card bo 12, padding header/body 12, gap segment 8, divider | Sửa spacing/card, option có viền, footer tách section | MATCH cấu trúc; chưa đo app screenshot | `contribution-wizard.style.tsx:4` |
| Bước 1: số bước + Mức giá & Mục đích phù hợp | Heading có số bước và trạng thái thực tế, không prefill “Đã điền” | MATCH | `contribution-wizard.view.tsx:381` |
| Mức giá thực tế / người; bốn khoảng giá | Lưới 2×2, chọn/bỏ chọn; mọi nhãn có / người; VND integer minor units, không ×1.000 lần nữa | MATCH control/order; CHANGED nhãn thêm đơn vị theo owner | `contribution-wizard.view.tsx:447`, `contribution-form.ts:65` |
| Giá chưa biết / các unit phụ / nhập min-max thường trực | Bỏ chip “Chưa biết giá”, 6 chip đơn vị và nút nhập giá. Không chọn giá thì omit price theo chính sách hiện có; không gắn bắt buộc giả | CHANGED — giữ contract price optional và unknown-price omission của lần trước | `contribution-wizard.view.tsx:447`, `contribution-form.ts:55` |
| Trên 200k | Chỉ khoảng này mở ô upper bound VND để nhập giá thực; không tự tạo upper bound | CHANGED — contract chỉ nhận bounded range | `contribution-wizard.view.tsx:481` |
| Hẹn hò lãng mạn | `suitability.couple` | MATCH | `contribution-options.ts:4` |
| Làm việc / Đọc sách | `suitability.work_reading` | MATCH | `contribution-options.ts:4` |
| Tụ tập bạn bè | `suitability.group` | MATCH | `contribution-options.ts:4` |
| Đi gia đình | `suitability.family` | MATCH | `contribution-options.ts:4` |
| Sống ảo check-in | Không có key trong suitability; không dùng `checkin_tag.photogenic` sai kind | HIDDEN — thiếu key đúng kind | `contribution-options.ts:4` |
| Bước 2: “2. Không gian & Tiện ích thực tế” + “Trải nghiệm” | Heading có số và tag đúng copy | MATCH | `contribution-wizard.view.tsx:381` |
| Vibe & Không gian thực tế — Chọn từ 1-3 vibe; mô tả | Đúng hierarchy/copy; chỉ whitelist Stitch, không render mọi mood | MATCH | `contribution-wizard.view.tsx:497` |
| Yên tĩnh riêng tư | Không có key mood phù hợp; không lấy `checkin_tag.quiet` | HIDDEN — thiếu key | `contribution-options.ts:5` |
| Nhạc nhẹ acoustic | Không có key mood phù hợp | HIDDEN — thiếu key | `contribution-options.ts:5` |
| Sân vườn thoáng đãng | Không có key mood phù hợp; không thay bằng setting.outdoor | HIDDEN — thiếu key | `contribution-options.ts:5` |
| Phòng lạnh êm | Không có key mood phù hợp; không thay bằng setting.indoor/cozy | HIDDEN — thiếu key | `contribution-options.ts:5` |
| View rooftop | Chỉ có setting.rooftop, không có mood key đúng contract vibeKeys | HIDDEN — thiếu key đúng kind | `contribution-options.ts:5` |
| Sôi động náo nhiệt | `mood.festive`, là option thứ 6 của source; chỉ nó hiện trên DEV hiện tại | MATCH mapping | `contribution-options.ts:5` |
| Tiện ích dân đi chơi mới biết — Chạm để tick chọn; mô tả | Checklist có icon + nhãn + checkbox; không có chip tiện ích | MATCH | `contribution-wizard.view.tsx:505` |
| Chỗ đỗ ô tô thuận tiện (Google Maps hay thiếu) | `amenity.car_parking` | MATCH checklist row | `contribution-wizard.view.tsx:507` |
| Ổ cắm điện từng bàn (tiện làm việc) | Contract có power_at_each_table nhưng DEV không trả; `power_outlets` không chứng minh mỗi bàn | HIDDEN — thiếu key chính xác | `contribution-form.ts:8` |
| Cho phép mang thú cưng (Pet-friendly) | `amenity.pets_allowed` | MATCH checklist row | `contribution-wizard.view.tsx:507` |
| Khu vực hút thuốc riêng biệt | separate_smoking_area có trong contract nhưng DEV không trả | HIDDEN — thiếu taxonomy key | `contribution-form.ts:8` |
| Mở thâu đêm / sau 23h | open_after_23 có trong contract nhưng DEV không trả | HIDDEN — thiếu taxonomy key | `contribution-form.ts:8` |
| Có bàn lớn cho nhóm >6 người | tables_over_six có trong contract nhưng DEV không trả | HIDDEN — thiếu taxonomy key | `contribution-form.ts:8` |
| Footer bước 2: Quay lại / Bước 2 / 3 hoàn thành / Tiếp tục sang Bước 3 | Đúng thứ tự; không thêm bonus vào nhãn CTA theo copy owner | MATCH | `contribution-wizard.view.tsx:584` |
| Bước 3: số bước + Menu, Hoá đơn & Mẹo thực tế; +20 GoGo Credit | Đúng heading, +20 có “khi được duyệt” | CHANGED wording thưởng theo owner | `contribution-wizard.view.tsx:381` |
| Ảnh menu/bill: tiles mẫu | Không có evidence thật; không render ảnh mẫu, nút xoá giả hoặc tên bill mẫu | HIDDEN — chưa có dữ liệu thật/luồng upload | `contribution-wizard.view.tsx:545` |
| + Tải thêm ảnh menu/bill (Tối đa 5 ảnh), viền dashed | Giữ control disabled, icon và lý do; có “Không bắt buộc” | CHANGED — #793/#794/#796 chưa có đường upload submission khả dụng | `contribution-wizard.view.tsx:545` |
| Lời hứa che thông tin tự động | Không khẳng định đã che; giải thích upload đang chờ xác nhận quyền sở hữu + che PII | CHANGED — không giả chức năng chưa có | `contribution-wizard.view.tsx:558` |
| Món ngon phải thử & Mẹo khi ghé — Không bắt buộc | Một input, không có hai textarea; không prefill. Gửi vào visitTips (max 2.000). Nháp cũ hiện cả dishes và tips; sửa input thay rõ ràng thành một nội dung mới | MATCH control; copy rút Must-try theo tên owner yêu cầu | `contribution-wizard.view.tsx:566`, `:166` |
| Đánh giá phục vụ & Không gian — 5 sao + score text | Một hàng 5 sao, score thật theo lựa chọn; ban đầu chưa đánh giá. Chọn lại sao hiện tại để xoá; gắn Không bắt buộc theo owner. Lựa chọn chung gửi cùng điểm cho hai trường contract; nháp cũ giữ điểm riêng nếu chưa sửa | CHANGED — không prefill 5.0; optional; không còn hai hàng sao | `contribution-wizard.view.tsx:204`, `contribution-form.ts:57` |
| Nhân viên thân thiện | Không có checkin_tag tương ứng; không tạo service_friendly | HIDDEN — thiếu key | `contribution-options.ts:6` |
| Lên món nhanh | Không có checkin_tag tương ứng; không dùng slow_service đảo nghĩa | HIDDEN — thiếu key | `contribution-options.ts:6` |
| Nhạc vừa tai | Không có checkin_tag tương ứng; không tạo space_music | HIDDEN — thiếu key | `contribution-options.ts:6` |
| Footer bước 3: Bước 3 / 3 hoàn thành + Hoàn tất | Nút thật; cho gửi bước 3 trống, chỉ mẹo, chỉ rating, hoặc xoá rating; giữ guard offline/busy/place chưa mở và bước 1–2 | MATCH theo copy + optional override owner | `contribution-wizard.view.tsx:584`, `contribution-form.ts:57` |
| +70 GoGo Credit / sẵn sàng / nhận thưởng ngay | Hiện +50 tiềm năng; không nâng tổng lên +70 khi chưa có ảnh. Chính sách +20 hiện riêng, có điều kiện duyệt. Không có code cộng credit phía client | HIDDEN tổng +70 — không có menu/bill evidence; không biến sample state thành thưởng thật | `contribution-wizard.view.tsx:319`, `:629` |
| Gửi địa điểm cho GoGo primary + pill; Lưu nháp secondary | Giữ đúng thứ tự; thêm pill thưởng có điều kiện; không để các trường bước 3 chặn submit. Nháp vẫn có version/conflict/resume/delete | MATCH cấu trúc; CHANGED wording theo owner | `contribution-wizard.view.tsx:620`, `:640` |
| Quy chuẩn kiểm duyệt GoGo | Giữ copy đã được duyệt: +50 khi được duyệt, thêm +20 cho ảnh được duyệt; không tự hứa 24 giờ | CHANGED theo owner | `contribution-wizard.view.tsx:713`, `src/shared/i18n/vi.ts:1117` |
| Dark | Cùng cấu trúc/copy/state, dùng token redesign → night; không có source Dark | **FAIL parity: no Stitch Dark**; chưa có ảnh app để đo | `contribution-wizard.style.tsx:4` |

Các file không có tiền tố ở bảng nằm trong `src/features/place-import/`.
DEV thực tế: **4/5 purpose, 1/6 vibe, 2/6 checklist, 0/3 rating chips**.
Không thêm taxonomy để làm đẹp form. Muốn đủ số lượng như source cần backend
cung cấp key đúng kind và mapping xác minh trước; không đổi endpoint/contract
trong task này. Option ngoài Stitch và tag nháp cũ ngoài whitelist không đi vào
submission/draft write. Selection cũ ở bước 1–2 không còn khả dụng vẫn cần bỏ rõ
ràng; field optional bước 3 không chặn “Hoàn tất” hoặc gửi.

## Verification sau sửa

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, không error/warning.
- Regression FAIL-before: chạy test form mới với đúng file form từ HEAD
  `e02440b`; 2 test thất bại, trong đó empty-step-3 trả undefined thay vì payload.
  Khôi phục file đã sửa: form + draft API **2 suites / 13 tests PASS**.
- `pnpm test`: **113 suites PASS, 1 FAIL, 1 skipped; 1.324 tests PASS,
  3 FAIL, 39 skipped**. Cả 3 lỗi ở file không sửa
  `src/shared/config/__tests__/distribute-wrapper.test.ts`, các dòng 208/234/258.
  Diagnostic `spawnSync('ps', ...)` trả `{status:null,error:"EPERM"}` trong sandbox.
  Không sửa distribution script, bỏ assertion, skip test hay đổi permission để
  tạo kết quả xanh. **Full Vitest chưa xanh; gate bị chặn bởi môi trường.**
- Full `pnpm test:ui --runInBand`: **182 suites / 2.162 tests PASS**.
- Lượt cuối sau chỉnh guard taxonomy: **5 suites / 81 tests PASS**, gồm wizard,
  owner import, resolution-token, future-opening, submission-status. Có kiểm tra
  nháp cũ, i18n, checklist đầy đủ đúng thứ tự, empty/tips-only/rating-only bước 3.
  Mỗi bước 3 chỉ có một input và một hàng 5 radio; không render chip ngoài mapping.
- `git diff --check`: PASS.
- Không install, native build, commit, push, sửa backend hoặc ghi vào Stitch.

Cần device acceptance: chụp app cả 3 bước Light/Dark trên build chứa patch,
so cạnh ảnh source ở 390pt và narrow/large text, kiểm tra keyboard và VoiceOver.
Đã đọc/so source HTML + ảnh **3/3**; pixel parity app **0/3, chưa đo**.
Dark source vẫn thiếu; không tuyên bố 100% visual parity hay DEV acceptance.

TASK GoGo-MobileApp#518 / BASE PR #516 / HEAD e02440b + uncommitted patch
LEFT: full Vitest môi trường ps EPERM; taxonomy thiếu; upload evidence; device
visual acceptance; FAIL parity Dark. Không commit/push.
