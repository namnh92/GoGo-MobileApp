# PR #540 — Astra r1: lưu riêng trường đã sửa

Ngày 2026-11-08, worktree `mobile-537`, HEAD nền `4c3b511`. Thay đổi local, không commit/push.

## Hành vi

- Form lấy giá trị mới từ `/me`; `keepDirtyValues` giữ bản nháp và cập nhật trường chưa sửa.
- PATCH chỉ chứa trường dirty có giá trị khác server mới nhất. Tên so sánh sau trim; ngày sinh so sánh theo ISO; chỉ thao tác xóa ngày sinh mới gửi `null`.
- Bản nháp trùng giá trị server trở về clean để tiếp tục nhận các lần refetch sau. Định dạng đang nhập được giữ nguyên.
- Sau lưu, reset từ giá trị form hiện tại để không đưa giá trị cũ trở lại trường vừa refetch trong lúc request chạy. Giữ validation, chống lưu trùng, xác nhận bỏ bản nháp và cách ly tài khoản.
- Giữ hợp đồng `ProfilePatch` hiện tại: omitted giữ nguyên, null xóa. Event ngày sinh chỉ phát khi PATCH có thay đổi ngày sinh.

## Regression FAIL-before / PASS-after

Lệnh: `pnpm test:ui --runInBand src/features/__tests__/account-date-of-birth.spec.tsx`.

Chạy cùng bộ 25 tests với source account gốc lấy từ HEAD `4c3b511`: **exit 1, 13 fail / 12 pass**. Khôi phục source đã sửa và chạy lại: **exit 0, 25 pass**.

Coverage: name-only/birthday-only PATCH, xóa ngày sinh, refetch khi chưa sửa hoặc đang sửa một trường, hoàn tác một trường, server cập nhật trùng bản nháp, refetch tiếp sau khi trùng, tương đương sau chuẩn hóa, refetch trong lúc lưu, validation, retry, chống request trùng, xác nhận bỏ bản nháp và đổi tài khoản.

Logs local: [before](/tmp/pr540-r1-before.log), [after](/tmp/pr540-r1-after.log).

## Gates

| Lệnh | Kết quả | Log |
|---|---|---|
| `pnpm typecheck` | PASS, exit 0 | [typecheck](/tmp/pr540-r1-typecheck.log) |
| `pnpm lint` | PASS, exit 0; không errors/warnings | [lint](/tmp/pr540-r1-lint.log) |
| `pnpm test` | Exit 1: 135 files pass, 1 fail, 1 skip; 1.634 tests pass, 3 fail, 39 skip | [unit](/tmp/pr540-r1-test.log) |
| `pnpm test:ui --runInBand` | PASS, exit 0; 198 suites / 2.469 tests | [UI](/tmp/pr540-r1-test-ui.log) |
| `git diff --check` | PASS, exit 0 | Kiểm tra local |

Ba lỗi unit nằm trong `src/shared/config/__tests__/distribute-wrapper.test.ts:208`, `:234`, `:258`, ngoài source sửa. Sandbox từ chối `ps` (`Operation not permitted`) và `pgrep` không lấy được process list (`sysmon request failed`, `Cannot get process list`). Case đầu không có stdout để `.trim()`; hai case còn lại nhận exit 0 thay vì phát hiện process group sống. Không sửa hoặc skip các tests này; không claim full unit gate pass.

Chưa xác nhận native/device hoặc DEV acceptance trong lượt này.
