# GoGo-MobileApp#401 — ngân sách bản nháp GoGo AI

## Phạm vi và nguyên nhân

Kiểm tra cây code re-design hiện tại ngày 2026-11-10, không chạy git.
Lỗi vẫn tồn tại sau redesign #558: `proposalRows` chỉ kiểm tra
`typeof budgetAmount.value === 'number'`, nên `0` được định dạng thành
`0 / người`, kèm nhãn ngân sách do AI tự đặt khi `origin: assumed`.
Nếu thiếu amount, `budgetMode` còn rơi xuống nhánh hiển thị field generic.
Đây là lỗi trình bày xác nhận được bằng component test; chưa xác định payload
của bản dev `d392961` trong báo cáo gốc do không có bản ghi payload đó.

Theo `core.md` 4, 13 và SRS FR-ROOM-003/004, dòng ngân sách chỉ hiển thị khi
amount là số nguyên dương an toàn ở đơn vị nhỏ nhất và mode là `per_person`
hoặc `total`. Thiếu/không hợp lệ thì ẩn cả dòng, hint và accessibility row;
không hiển thị tên field hay JSON thay thế. Dùng nguyên các i18n key hiện có.

Sửa tại `src/features/assistant/proposal-rows.ts`, dùng chung bởi
`ConfirmationCard` và `TaskSummary`. Không đổi API, dữ liệu, confirm payload,
role token hay style/view. Contract `AssistantProposalValue` trong
`openapi/gogo.v1.yaml` đã có field/value/origin/editable; không cần sửa contract
để xử lý lỗi hiển thị này. Không thêm telemetry chứa payload/ngân sách.

## Bằng chứng hồi quy

Test: `src/features/__tests__/assistant-budget.spec.tsx`.

- Hai locale vi/en, hai surface xác nhận/kết quả đã lưu.
- Amount thiếu, null, 0, âm, thập phân, NaN, Infinity, string, object.
- Mode thiếu, null, không biết, object; không suy đoán thành tổng nhóm.
- Ngân sách hợp lệ giữ nguyên đơn vị theo người/tổng nhóm và accessibility.
- Confirm không bị sửa payload hoặc mutate proposal khi ẩn ngân sách 0.

Lệnh tập trung:
`pnpm test:ui --runInBand src/features/__tests__/assistant-budget.spec.tsx`.

- FAIL-before: 52 failed, 10 passed; trong đó ca zero thất bại trên cả hai
  surface và hai locale vì vẫn có dòng Ngân sách/Budget.
- PASS-after: 62 passed, cùng file test không thay đổi.
- Log cục bộ: `/tmp/mobile-401-before.log`, `/tmp/mobile-401-after.log`.

SHA-256 ràng buộc bằng chứng không dùng git:

| File | Trước sửa | Sau sửa |
| --- | --- | --- |
| `src/features/assistant/proposal-rows.ts` | `c82748ae44bddb29dbe43aecac89adfb95b3601f3fbcd1dc5adf9d55524b83da` | `ff7768dd7b5d257144799187f9219ac3fa62021c9d9c4de916d6523293a0435e` |
| `src/features/__tests__/assistant-budget.spec.tsx` | `af2b574770ecbd0650cfb1d07d6ba97d5c0a40b55c4b7531b25575f8e2cf34e6` | `af2b574770ecbd0650cfb1d07d6ba97d5c0a40b55c4b7531b25575f8e2cf34e6` |

## Cổng kiểm tra

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm test:ui --runInBand`: PASS — 237 suites, 3529 tests, 11 snapshots.
  Có cả các suite hội thoại/edit/confirm AI hiện hành và test hồi quy #401.
- Log cục bộ: `/tmp/mobile-401-typecheck.log`, `/tmp/mobile-401-lint.log`,
  `/tmp/mobile-401-ui.log`. Hash hai file source/test ở trên được kiểm lại
  cuối lượt chạy và không thay đổi.
- Nghiệm thu trên bản dev chứa sửa đổi: NOT RUN; component test không thay
  thế nghiệm thu AC trên build. Chưa đóng issue.
