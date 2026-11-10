# GoGo-MobileApp #612 — giờ yên lặng

## Thay đổi

- Copy nguyên spec từ `../be-829/openapi/gogo.v1.yaml`, contract
  `9.1.1-alpha.1`, và generate bằng `pnpm api:types`. Checkout này không có
  script `api:sync`/`api:generate`; không dùng sibling BE cũ.
- Capability compile-check theo `NotificationSettings.quietHours` trong client
  generated. Chỉ mở công tắc khi response có giá trị, version và strong ETag;
  response cũ/thiếu field vẫn khóa và giải thích.
- GET đọc giá trị tài khoản; PATCH chỉ ghi `quietHours`. Bật dùng timezone IANA
  đã lưu, hoặc timezone thiết bị nếu tài khoản chưa lưu. Không tự chọn timezone
  mặc định nếu thiết bị không trả về. Tắt giữ nguyên timezone đã lưu.
- Dùng hook mutation hiện có: optimistic cache, rollback, ETag/If-Match,
  idempotency, refetch sau 412, khóa chung với master/category và bảo vệ session.
  Không thay đổi master, categories, inbox hay đăng ký push.
- Giữ công tắc 23:00–07:00 và copy giải thích inbox tức thì/push hoãn. Nhắc
  120 phút do BE quản lý, không thêm UI hoặc scheduler trên app.

## Regression

- UI: đọc bật/tắt, gửi payload tối thiểu, ưu tiên timezone tài khoản, lấy timezone
  thiết bị, khóa khi thiếu timezone/field/validator, đang lưu/refetch/offline,
  retry intent sau lỗi.
- Hook: optimistic bật/tắt, giữ timezone, rollback và giữ inbox/master/category;
  lỗi không rõ kết quả giữ idempotency key/validator; 412 dùng validator mới sau
  refetch. Các test master/category và chuyển tài khoản tiếp tục chạy.
- API adapter: GET/PATCH quiet hours, If-Match, Idempotency-Key và ETag trả về.

## Owner nghiệm thu trên simulator với DEV — chưa chạy

1. Mở Cài đặt thông báo với tài khoản chưa chọn giờ yên lặng: mặc định tắt.
2. Bật, rời màn hình rồi mở lại: giá trị vẫn bật. Kiểm tra request PATCH có
   timezone IANA và If-Match từ GET; master/category không thay đổi.
3. Tắt rồi mở lại: vẫn tắt. Thử lỗi mạng khi lưu: giá trị rollback, báo lỗi và
   thử lưu lại được. Hai client sửa đồng thời: 412 refetch trước intent kế tiếp.
4. Trong 23:00–07:00 theo timezone đã lưu, kiểm tra inbox ghi ngay và push hoãn
   qua BE; xác nhận nhắc 120 phút không cần thiết lập mới trên app.

Không chạy git. Không ghi nhận nghiệm thu DEV hoặc simulator từ unit tests.

## Kết quả local 2026-11-10

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm api:check` | PASS |
| `pnpm test:ui --runInBand` | PASS — 236 suites, 3481 tests, 11 snapshots |
| `pnpm exec vitest run src/shared/api/__tests__/notification-inbox.test.ts` | PASS — 6 tests |

Lượt UI đầu bắt được assertion capability cũ `quietHours=false`. Đã cập nhật
theo contract mới, chạy lại nguyên bộ UI và đạt kết quả trong bảng.
