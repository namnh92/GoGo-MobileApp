# Xác minh #647 — checkbox cho Chọn sở thích

Ngày: 2026-11-11. Refs #647, #594; xếp chồng trên PR #598.

- Worktree: `dev/worktrees/mobile-647`.
- Nhánh: `feature/GOGO-647-preference-checkbox`.
- HEAD nền: `b776724a` (HEAD giữ nguyên; bản sửa chưa stage/commit).
- Phạm vi: chuyển tiêu chí từ Chip sang CheckboxRow chung, cùng cách dùng của create-mood; không sửa component chung hoặc hai caller hiện có.

## Thay đổi

- Danh sách checkbox dọc; giữ emoji, nhãn taxonomy theo locale và fallback tiếng Việt.
- Checkbox cung cấp role `checkbox`, checked/disabled state và nhãn truy cập. Tối đa ba mục: khóa mục chưa chọn, vẫn cho bỏ chọn; dùng hint vi/en có sẵn và thông báo live region như create-mood.
- Giữ banner `Đã chọn: n/3 tiêu chí`, CTA `Tiếp tục (n)`, seed từ wizard/server và chức năng dùng sở thích đã lưu.
- Nền cũ chỉ giới hạn tối đa ba, chưa chặn CTA khi dưới hai. Bản sửa thực thi luật 2–3 theo yêu cầu owner: disable CTA và guard handler khi số lượng ngoài khoảng này.
- Payload không đổi: `{ selections: { mood: keys }, expectedVersion }`; save thành công rồi mới complete. Telemetry và điều hướng giữ nguyên.
- View/style vẫn tách; chuyển padding tĩnh sang style. CheckboxRow dùng AppToken `surface.subtle`, `accent.text`, `text.primary` theo Light/Dark; không thêm màu hay chuỗi dịch mới.
- Giữ nguyên nhánh loading/error và trạng thái taxonomy rỗng hiện có (không có tiêu chí; banner vẫn hiện, CTA bị chặn nếu chưa đủ hai mục). Không thêm màn empty mới.

## FAIL-before / PASS-after

Cùng bộ specs cuối cùng được chạy trên view/style nguyên bản lấy bằng `git show b776724a:<path>`, sau đó khôi phục bản sửa trong `finally`. Không đổi HEAD/index.

**FAIL-before:** `pnpm test:ui preference --runInBand`, exit 1.

```text
Unable to find an element with role: checkbox, checked state: false
Expected: true
Received: false
Test Suites: 1 failed, 1 total
Tests:       8 failed, 8 passed, 16 total
```

Nguyên nhân mong đợi: chip không có role checkbox; CTA chưa disabled dưới hai lựa chọn. Log đầy đủ: `/tmp/issue-647-fail-before.log`.

**PASS-after:** `pnpm test:ui preference matching --runInBand`, exit 0.

```text
PASS src/features/__tests__/prefill-preference.spec.tsx
PASS src/features/__tests__/matching-orbit.spec.tsx
Test Suites: 2 passed, 2 total
Tests:       22 passed, 22 total
```

Log: `/tmp/issue-647-pass-after.log`.

Specs xác minh unchecked/checked, emoji, prefill, số đếm/CTA, chặn mục thứ tư, bỏ chọn để mở lại, payload hai và ba mục (giữ thứ tự key/version), save trước complete, lỗi save không complete, loading/error/empty và bốn tổ hợp Light/Dark × vi/en với style token thực của CheckboxRow.

## Checks

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui preference matching --runInBand` | PASS, 22 tests |
| `pnpm exec eslint src/features/matching/preference.view.tsx src/features/matching/preference.style.tsx src/features/__tests__/prefill-preference.spec.tsx` | PASS, exit 0, không cảnh báo |
| `git diff --check` | PASS |

Log typecheck/lint: `/tmp/issue-647-typecheck.log`, `/tmp/issue-647-lint.log`.

Chỉ xác minh component bằng Jest và static checks; chưa kiểm simulator/VoiceOver hoặc DEV acceptance. Không git add/commit, không push/PR/merge/deploy. Rollback: hoàn nguyên patch riêng #647; không thay đổi contract API.
