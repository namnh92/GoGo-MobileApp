# GoGo-MobileApp #620 — quên mật khẩu

## Phạm vi

- “Quên?” trên Đăng nhập mở `/auth/forgot-password`; request 202 giữ nguyên
  `/auth/forgot-password`, đổi email input thành OTP 6 ô. Đủ mã mới mở
  `/auth/reset-password` (chỉ mật khẩu + checklist). Reset 204 về Đăng nhập với thông báo đổi mật khẩu,
  giữ ý định `next`, không cài phiên mới.
- Dùng `OpBody`/`OpResponse` từ client generated theo `openapi/gogo.v1.yaml`:
  `requestPasswordRecovery`, `completePasswordRecovery`, `challengeId`,
  `expiresAt`, `resendAvailableAt`, `Idempotency-Key`; cả hai request anonymous.
- Email/challenge/code chỉ ở navigation state tạm trong bộ nhớ; password ở form.
  Không đưa chúng vào route params, analytics hay storage. Khi rời recovery, xóa flow; chuyển OTP ↔ password giữ proof tạm; mutation cache đặt `gcTime: 0`.
- Retry thủ công sau lỗi mạng/503 giữ key cho cùng payload; thành công tạo intent
  tiếp theo. Không tự retry vì BE tính quota cả replay. 429 dùng `Retry-After`,
  chờ 60 giây nếu thiếu mốc hợp lệ. Lịch sử request trong bộ nhớ theo email
  chuẩn hóa (trim/lowercase) áp dụng 1/phút + 3/giờ, gồm request đầu tiên,
  request lỗi và replay; rời màn hình không xóa quota phiên.
- Email không có placeholder; nút gửi chỉ bật khi schema email chung với đăng
  nhập hợp lệ. Lỗi inline khi blur hoặc submit bàn phím.
- Countdown mã dùng `expiresAt` từ API; fallback request time + 300 giây nếu
  thiếu mốc hợp lệ. Nút primary ở OTP bị khóa, label “Gửi lại mã sau 4:59”; hết hạn bật
  “Gửi lại mã” nếu quota cho phép. Nếu quota/Retry-After dài hơn expiry, label
  dùng thời gian chờ dài hơn. Hết hạn khóa nhập mã để chuyển bước/hoàn tất
  và hiện thông báo.
- Resend thành công thay challenge, xóa mã cũ, dùng `resendAvailableAt` mới.
  Deadline được cập nhật khi foreground, không trừ bộ đếm theo thời gian nền.
- Owner 2026-11-10 / BE#835: bỏ copy anti-enumeration vi/en. Chỉ request
  202 mới chuyển sang trạng thái OTP trên cùng màn; 404 + RECOVERY_ACCOUNT_NOT_FOUND hiện
  “Tài khoản không tồn tại.” dưới email, giữ màn hiện tại và xóa lỗi khi sửa email.
  Contract `9.2.0-alpha.1` (BE#836) được sao chép nguyên byte; client được generate
  lại bằng `pnpm api:types`. Dùng status của ApiError và code được ràng buộc bằng
  response 404 generated; fixture 404 cũng kiểm tra theo type này. RECOVERY_INVALID, offline, 429, 503 mail
  chưa cấu hình/unavailable giữ copy vi/en; không vẽ server message.
- Sáu ô mã có nhãn, tự chuyển focus, dán/autofill 6 số, backspace quay về ô trước.
  PasswordRequirements hiện có kiểm tra năm điều kiện; mật khẩu có hiện/ẩn.
- AppHeader có opt-in căn giữa/màu tiêu đề; các màn cũ giữ mặc định. Bổ sung
  hai route vào danh sách template Sentry và đăng ký computed i18n keys.

## Tham chiếu giao diện

Tham chiếu ban đầu (trước owner redesign bên dưới): đã đọc HTML trong Stitch project `17315762413421369447`:

- Quên mật khẩu - GoGo: `9c9a8c32b5ae4deb94f15e68b2ce1741`.
- Đặt lại mật khẩu - GoGo: `87fdbe76a970497ba8ea6a594eb792be`.

Dùng AppHeader, LabelledInput, PrimaryBtn (LoadingIndicator khi busy),
PasswordRequirements và role tokens. View/style tách riêng, bố cục cuộn được khi
mở bàn phím. Test resolve sheet riêng cho Light/Dark; Jest Unistyles không mô
phỏng việc chuyển theme native trực tiếp.

## Regression tự động

`src/features/auth/__tests__/password-recovery.spec.tsx` chạy API wrapper và
HTTP client thật qua fetch giả lập: email validation/trim, loading/disable,
payload/header anonymous/idempotency, giữ cùng màn sau 202, chỉ chuyển khi đủ 6 số, retry request
và complete, lỗi 404/429/503/offline/RECOVERY_INVALID (quay về OTP), dán mã, password validation,
checklist/visibility, email che, role tokens Light/Dark, deadline foreground,
resend thay proof và giữ proof khi lỗi, 204 không cài phiên, xóa flow khi unmount,
success copy vi/en, direct reset thiếu flow. Fake timers kiểm countdown, expiry trong label primary
→ resend, khóa chuyển bước/hoàn tất, quota 3 request/giờ (gồm request đầu), khóa theo email
qua remount, mở lại khi request cũ ra khỏi cửa sổ một giờ, Retry-After dạng
seconds/HTTP date và fallback 60 giây.

## Owner kiểm simulator với DEV — chưa chạy

1. Light/vi: Đăng nhập → Quên? → nhập email → Gửi mã. Kiểm tra header, nút busy,
   không có note 5 phút/link quay lại đăng nhập; bàn phím không che CTA.
   Sau 202 vẫn cùng màn, chỉ hiện email che + OTP, không có “Đổi email”.
2. Kiểm tra email che, nhập từng số, dán toàn bộ 6 số vào các ô, autofill trên
   thiết bị nếu có, backspace và VoiceOver đọc nhãn từng ô.
3. Kiểm countdown từ thời điểm API, ví dụ 4:59. Sau 60 giây nút vẫn khóa với label countdown expiry;
   sau 300 giây nút bật “Gửi lại mã” nếu quota cho phép; thông báo hết hạn.
   Đủ 6 số trước expiry chuyển sang password/checklist, không còn ô code.
   Không có action “Đổi email” trong OTP. Thử đưa app
   xuống nền rồi quay lại. Gửi lại mã xóa mã cũ và bắt đầu countdown mới.
   Sau request thứ ba trong giờ, kiểm nút gửi lại bị khóa với thời gian chờ;
   rời màn rồi nhập lại cùng email vẫn bị khóa, email khác có quota riêng.
4. Đủ năm điều kiện mật khẩu, thử hiện/ẩn. Reset thành công về Đăng nhập có
   thông báo; mật khẩu mới đăng nhập được, mật khẩu cũ bị từ chối. Kiểm tra trên
   phiên thiết bị khác rằng BE đã thu hồi session/refresh token.
5. Thử mã sai/hết hạn: RECOVERY_INVALID trên complete trả về OTP trống với lỗi.
   Header back trên password trả về OTP. Thử offline, quota 429 và môi trường mail chưa cấu hình 503.
   Thử email không có tài khoản password hợp lệ: 404 RECOVERY_ACCOUNT_NOT_FOUND
   hiện “Tài khoản không tồn tại.” dưới email và không chuyển màn. Chỉ 202 mở
   màn nhập mã. Kiểm tra subtitle vi/en không còn điều kiện eligibility.
6. Lặp lại Dark/en; kiểm bố cục trên màn hình nhỏ và khi mở bàn phím.

Không chạy git. Unit/UI tests không xác nhận giao nhận email hoặc nghiệm thu DEV.

## Kết quả local trước cập nhật BE#835 — 2026-11-10

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, không warning lint |
| `pnpm test:ui --runInBand` | PASS — 237 suites, 3510 tests, 11 snapshots |
| UI tập trung recovery | PASS — 27 tests |

Lượt UI đầu phát hiện thiếu hai route trong allowlist Sentry và thiếu đăng ký
computed i18n keys. Đã bổ sung, chạy lại nguyên bộ UI và đạt kết quả trên.
Không tìm thấy `RTK.md` trong worktree, các thư mục cha đã kiểm tra, hoặc các
thư mục cấu hình `.agents`/`.codex`; dùng `CLAUDE.md` và yêu cầu issue hiện tại.

## Cập nhật owner / BE#835 — 2026-11-10

- Subtitle quên mật khẩu vi đúng Stitch: “Nhập email đã đăng ký. GoGo sẽ gửi
  mã 6 số để bạn đặt lại mật khẩu.”; en tương đương. Bỏ eligibility copy
  khỏi màn nhập mã ở cả hai locale.
- Regression bổ sung: lỗi 404 inline vi/en, giữ màn/email, không tạo flow;
  sửa email xóa lỗi và request 202 tiếp theo điều hướng thành công với intent
  mới. Sai status/code hoặc status thành công ngoài 202 không điều hướng.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, không warning lint.
- `pnpm test:ui --runInBand`: PASS — 237 suites, 3516 tests, 11 snapshots.
  Recovery: 33 tests. Full run đầu bắt lỗi computed i18n expression; đã sửa
  và chạy lại toàn bộ các kiểm tra trên thành công.
- Không chạy git. Chưa kiểm simulator/DEV hoặc xác nhận BE#835 đã triển khai.

## Owner redesign — 2026-11-10, PR #622 / Refs #620

Quyết định owner trong yêu cầu hiện tại là sai khác có chủ ý với Stitch:

- Bỏ link “Quay lại đăng nhập” và note “Mã hết hạn sau 5 phút.”; dùng header back.
- 202 giữ nguyên màn forgot-password: email input → OTP 6 ô, context email che,
  không còn action “Đổi email”. Không điều hướng trên request 202.
- Primary CTA chứa countdown từ expiry API, ví dụ “Gửi lại mã sau 4:59”; về 0
  bật “Gửi lại mã” nếu 1/phút, 3/giờ/email và Retry-After không còn khóa.
- Đủ 6 chữ số trước expiry chuyển sang reset-password, chỉ password/checklist.
  Email/challengeId/code giữ trong memory; không route params/storage/telemetry.
  RECOVERY_INVALID trả về OTP trống + lỗi, giữ challenge/email/next.
- Resend thay challenge và xóa digits khi thành công; lỗi giữ proof hiện tại.
  404 account-not-found, 503, offline, 429 và idempotency vẫn dùng shared API.
- Proof chuyển bước có thể kiểm trực tiếp từ source trước sửa: onSuccess 202
  gọi router.push reset-password, OTP và resend nằm trong reset-password.
  Regression hiện tại kiểm hành vi owner mới với fake timers.

Áp dụng hướng dẫn gogo-liquid-glass-ui, gogo-mobile-rn, gogo-quality-gates:
reuse components/tokens, view/style split, vi/en và regression đúng phạm vi.
RTK.md vẫn không có trong worktree/các thư mục cha đã kiểm tra; không chạy git.
Kết quả local cho lượt owner redesign này:

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, không warning lint |
| `pnpm test:ui --runInBand` | PASS — 237 suites, 3521 tests, 11 snapshots |
| Recovery + i18n tập trung | PASS — 79 tests (38 recovery) |

Lượt focused đầu: 33/35 pass; hai assertion giữ identity proof phát hiện cập nhật
`invalidCode: false` không cần thiết khi đang nhập OTP. Đã chỉ xóa lỗi khi nó
đang tồn tại, rồi chạy focused + i18n và full UI suite thành công như trên.
Không chạy git; không commit/push/merge. Chưa kiểm simulator/DEV hoặc giao nhận email.
