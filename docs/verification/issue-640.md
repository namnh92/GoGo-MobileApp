# GoGo-MobileApp #640 — D4 credit client

Phạm vi: contract `10.0.0-alpha.1`, UI và client data layer với base yêu cầu `re-design`.
Thực hiện theo `dev/handoffs/sa-shape-be-832-credit-spend-D.rev2.astra.md` §4/§7 và issue #640 được owner cung cấp. Không dùng lệnh git. Không thực hiện deploy hoặc paid activation; chưa xác nhận UI trên simulator/thiết bị.

## Hành vi

- Footer dưới composer giữ lượt miễn phí và hiển thị số credit đã ghi sổ của **toàn bộ conversation / số dư cá nhân hiện tại**, giải thích rõ hai đại lượng. Không cộng các message trên trang để suy ra tổng.
- Pending có nhãn riêng; số chưa biết hiển thị “Chưa xác định”, không đổi thành 0. Hiển thị credit giữ lại và credit có thể dùng khi có hold; chọn snapshot status/wallet mới hơn.
- Chỉ chặn trước vì thiếu credit khi status báo `insufficient_credit`. Số dư 0 vẫn gửi được nếu còn lượt miễn phí; paid sends bị tắt và hết miễn phí có lý do riêng. Các trạng thái unavailable/legacy limit vẫn giữ bảo vệ hiện có.
- HTTP 409 `ASSISTANT_INSUFFICIENT_CREDIT` giữ typed required/available details qua parser, chỉ cho phép các field công khai của contract. Giữ text, ảnh và context khi từ chối; không tự resend khi reset/grant. Chỉ xoá revision draft đã nhận 202. Retry khi chưa rõ acceptance giữ key và locale gốc.
- Refresh aggregate/status/wallet sau acceptance, terminal event và stop. Poll aggregate pending tối đa ba lần với khoảng chờ 2/5/15 giây; dừng khi settled, background, logout hoặc unmount. Session guards ngăn response cũ cập nhật cache sau đổi tài khoản. Reset/focus refresh chỉ đọc dữ liệu.
- Credit history nhóm theo ngày của thiết bị, rồi conversation, có tổng delta trong từng nhóm đang tải. Title fallback và eventLabels vi/en có fallback nguồn cũ. Giữ cursor 10, load more, refresh và các trạng thái loading/empty/error/offline.
- `credits` và `assistant` đều không được persist xuống đĩa. Dùng component/token hiện có và view/style split.

## Files

Contract/data:

- `openapi/gogo.v1.yaml`, `src/shared/api/schema.d.ts`, `types.ts`
- `src/shared/api/endpoints/assistant.ts`, `assistant-backend.ts`, `client.ts`, `errors.ts`, `query-keys.ts`, `persist-policy.ts`
- `src/shared/api/queries/use-assistant.ts`, `use-credits.ts`
- `src/shared/store/assistantDraftStore.ts`, `src/data/assistant/mock-backend.ts`

UI/i18n:

- `src/features/assistant/assistant.view.tsx`, `send-error.ts`, `usage-footer.view.tsx`, `usage-footer.style.tsx`
- `src/features/credits/credit-balance.view.tsx`, `credit-format.ts`, `credits.view.tsx`, `credits.style.tsx` (style dùng chung qua `credit-balance.style.tsx`)
- `src/shared/i18n/vi.ts`, `en.ts`

Tests:

- `src/shared/api/__tests__/credit-contract-pin.test.ts`, `credits.test.ts`
- `src/shared/api/queries/assistant-credits.spec.tsx`, `discovery-774.spec.tsx`
- `src/features/__tests__/assistant-usage-footer.spec.tsx`, `credits.spec.tsx`, `assistant-keyboard-offset.spec.tsx`
- Fixtures theo contract mới: `assistant-daily-limit.spec.tsx`, `assistant-navigation.spec.tsx`, `assistant-redesign-matrix.spec.tsx`, `assistant-states.spec.tsx`
- `src/features/assistant/__tests__/credit-footer.test.ts`, `history-groups.test.ts`, `src/features/credits/credit-format.test.ts`

## Kiểm tra

Ngày chạy: 2026-11-11, local workspace/sandbox. Log local lưu trong `/private/tmp/mobile640-*`.

| Kiểm tra | Kết quả |
| --- | --- |
| Chép spec và `pnpm api:types` | PASS; `cmp` xác nhận YAML giống byte-for-byte file `be-10.0.0.yaml` owner chỉ định |
| `pnpm -s api:check` | PASS, generated types khớp spec |
| `pnpm -s tsc --noEmit` | PASS, exit 0 |
| ESLint các file implementation/test mới liên quan | PASS, không diagnostics |
| `pnpm -s test:ui -- src/features src/shared/api` | PASS: 180 suites, 2.399 tests |
| Jest footer/history/i18n sau sửa sentence case của caption | PASS: 3 suites, 74 tests |
| `pnpm -s test` | Không khởi động được: EPERM khi Vite ghi config vào `node_modules/.vite-temp` dùng chung với worktree khác |
| `pnpm -s test --configLoader runner` | 150 files passed, 1 failed, 1 skipped; 1.772 tests passed, 3 failed, 39 skipped |

Ba Vitest failures đều thuộc `src/shared/config/__tests__/distribute-wrapper.test.ts`:

- `refuses while the owner is alive`
- `refuses recovery while a recorded build process group is still alive`
- `keeps the lock and run files when a recorded build group is still alive after the child exits`

Các test này phụ thuộc process inspection; lệnh kiểm tra trực tiếp `/bin/ps -o lstart= -p $$` cũng bị sandbox từ chối với `operation not permitted`. Không sửa suite hoặc nới sandbox để làm test xanh. Các suite credit/contract/i18n đều qua. Đây là kết quả local, chưa phải CI hoặc DEV/simulator acceptance.

Log chính: `/private/tmp/mobile640-jest-verified.log`, `mobile640-i18n-final.log`, `mobile640-vitest-complete.log`, `mobile640-tsc-complete.log`, `mobile640-api-check.log`, `mobile640-eslint.log`.
