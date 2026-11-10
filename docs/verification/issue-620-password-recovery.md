# GoGo-MobileApp #620 — quên mật khẩu

## Phạm vi

- “Quên?” trên Đăng nhập mở `/auth/forgot-password`; request 202 mở
  `/auth/reset-password`. Reset 204 về Đăng nhập với thông báo đổi mật khẩu,
  giữ ý định `next`, không cài phiên mới.
- Dùng `OpBody`/`OpResponse` từ client generated theo `openapi/gogo.v1.yaml`:
  `requestPasswordRecovery`, `completePasswordRecovery`, `challengeId`,
  `expiresAt`, `resendAvailableAt`, `Idempotency-Key`; cả hai request anonymous.
- Email/challenge chỉ ở navigation state trong bộ nhớ; code/password ở form.
  Không đưa chúng vào route params, analytics hay storage. Khi reset screen
  unmount, xóa flow; mutation cache đặt `gcTime: 0`.
- Retry thủ công sau lỗi mạng/503 giữ key cho cùng payload; thành công tạo intent
  tiếp theo. Không tự retry vì BE tính quota cả replay. 429 dùng `Retry-After`,
  tối thiểu chờ 60 giây nếu thiếu mốc hợp lệ.
- Resend thành công thay challenge, xóa mã cũ, dùng `resendAvailableAt` mới.
  Deadline được cập nhật khi foreground, không trừ bộ đếm theo thời gian nền.
- RECOVERY_INVALID, offline, 429, 503 mail chưa cấu hình/unavailable đều có copy
  vi/en. Không vẽ server message hay xác nhận tài khoản tồn tại; 503 không
  chuyển sang màn reset.
- Sáu ô mã có nhãn, tự chuyển focus, dán/autofill 6 số, backspace quay về ô trước.
  PasswordRequirements hiện có kiểm tra năm điều kiện; mật khẩu có hiện/ẩn.
- AppHeader có opt-in căn giữa/màu tiêu đề; các màn cũ giữ mặc định. Bổ sung
  hai route vào danh sách template Sentry và đăng ký computed i18n keys.

## Tham chiếu giao diện

Đã đọc HTML trong Stitch project `17315762413421369447`:

- Quên mật khẩu - GoGo: `9c9a8c32b5ae4deb94f15e68b2ce1741`.
- Đặt lại mật khẩu - GoGo: `87fdbe76a970497ba8ea6a594eb792be`.

Dùng AppHeader, LabelledInput, PrimaryBtn/GhostBtn (LoadingIndicator khi busy),
PasswordRequirements và role tokens. View/style tách riêng, bố cục cuộn được khi
mở bàn phím. Test resolve sheet riêng cho Light/Dark; Jest Unistyles không mô
phỏng việc chuyển theme native trực tiếp.

## Regression tự động

`src/features/auth/__tests__/password-recovery.spec.tsx` chạy API wrapper và
HTTP client thật qua fetch giả lập: email validation/trim, loading/disable,
payload/header anonymous/idempotency, không chuyển màn trước 202, retry request
và complete, lỗi 429/503/offline/RECOVERY_INVALID, dán mã, password validation,
checklist/visibility, email che, role tokens Light/Dark, deadline foreground,
resend thay proof và giữ proof khi lỗi, 204 không cài phiên, xóa flow khi unmount,
success copy vi/en, direct reset thiếu flow.

## Owner kiểm simulator với DEV — chưa chạy

1. Light/vi: Đăng nhập → Quên? → nhập email → Gửi mã. Kiểm tra header, nút busy,
   note 5 phút, bàn phím không che CTA và link quay lại đăng nhập.
2. Kiểm tra email che, nhập từng số, dán toàn bộ 6 số vào các ô, autofill trên
   thiết bị nếu có, backspace và VoiceOver đọc nhãn từng ô.
3. Chờ 60 giây; thử đưa app xuống nền rồi quay lại. Gửi lại mã: mã cũ bị xóa,
   cooldown bắt đầu lại; chỉ mã mới có hiệu lực.
4. Đủ năm điều kiện mật khẩu, thử hiện/ẩn. Reset thành công về Đăng nhập có
   thông báo; mật khẩu mới đăng nhập được, mật khẩu cũ bị từ chối. Kiểm tra trên
   phiên thiết bị khác rằng BE đã thu hồi session/refresh token.
5. Thử mã sai/hết hạn, offline, quota 429 và môi trường mail chưa cấu hình 503.
   Kiểm tra lỗi rõ ràng, không giả thành công hoặc lộ sự tồn tại email.
6. Lặp lại Dark/en; kiểm bố cục trên màn hình nhỏ và khi mở bàn phím.

Không chạy git. Unit/UI tests không xác nhận giao nhận email hoặc nghiệm thu DEV.

## Kết quả local 2026-11-10

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, không warning lint |
| `pnpm test:ui --runInBand` | PASS — 237 suites, 3503 tests, 11 snapshots |
| UI tập trung recovery | PASS — 20 tests |

Lượt UI đầu phát hiện thiếu hai route trong allowlist Sentry và thiếu đăng ký
computed i18n keys. Đã bổ sung, chạy lại nguyên bộ UI và đạt kết quả trên.
Không tìm thấy `RTK.md` trong worktree, các thư mục cha đã kiểm tra, hoặc các
thư mục cấu hình `.agents`/`.codex`; dùng `CLAUDE.md` và yêu cầu issue hiện tại.
