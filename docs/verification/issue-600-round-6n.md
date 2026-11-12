# #600 round 6n — tự làm mới link khi chia sẻ

Quyết định owner 2026-11-12; thay phần đổi link thủ công của round 6h.

- Bỏ nút `Đổi link mời`, testID `room-lobby-change-invite`, import và label
  i18n không còn dùng. Nhóm Quản lý giữ trạng thái link và `Huỷ phòng`.
- Header share giữ luồng kiểm tra metadata hiện có: code còn dùng được thì
  share; không còn invite dùng được (hết hạn, hết lượt, bị thu hồi hoặc chưa
  tạo) thì create rồi share, không xác nhận hay revoke invite đã vô hiệu.
- Chỉ invite còn dùng được nhưng thiết bị không có code mới mở xác nhận
  thay link. Giữ nội dung xác nhận, revoke mọi invite còn dùng được trước
  create/share, và xử lý lỗi/retry của đường này.
- Kiểm tra hết hạn bằng `Date.now()` và `expiresAt` của server. App không
  truyền hoặc tự tính TTL; thay TTL server từ 7 ngày sang 24 giờ thuộc BE.
- Giữ F-20/F-21: lỗi offline không có code không mở overlay/refetch/create;
  code còn hạn vẫn có fallback offline; deadline đọc metadata/preparation,
  expiry timer và kiểm tra lại ở tap/share boundary không đổi.
- Không commit, stash, push, merge hoặc deploy; chưa nghiệm thu native share
  trên simulator/thiết bị.

## Kiểm chứng

| Gate | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS; 0 errors, 4 warnings có sẵn ở assistant-keyboard-offset và assistant-usage-footer |
| Touched Jest specs | PASS; 4 suites, 54 tests |
| `invite-state.test.ts` (Vitest) | PASS; 13 tests |
| Full `pnpm test:ui --runInBand --watchman=false` | PASS; 268 suites, 4.319 tests, 11 snapshots |
| `git diff --check` | PASS |

Touched specs: `room-lobby-invites`, `room-lobby-members`,
`room-invite-reopen`, `room-host-actions-offline`. Coverage giữ confirm từ
header cho active-without-code, thêm expired stored code tạo/share code mới,
và xác nhận exhausted/valid-code không mở confirm hoặc revoke không cần thiết.

Logs: `/tmp/round6n-typecheck.log`, `/tmp/round6n-lint.log`,
`/tmp/round6n-invite-unit.log`, `/tmp/round6n-ui-full.log` và
`/tmp/round6n-ui-full.json`.
