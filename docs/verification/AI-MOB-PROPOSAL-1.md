# GoGo-MobileApp#394 — AI-MOB-PROPOSAL-1

Ngày: 2026-11-10. Phạm vi: UI hiện tại trong worktree `mobile-394`, từ re-design.
Không chạy git; không đổi API, dữ liệu đề xuất hoặc hành vi xác nhận.

## Nguyên nhân và sửa lỗi

`proposalRows` vẫn có fallback lấy tên field làm nhãn và `JSON.stringify`
làm giá trị. `administrativeArea` và `seedPlaceIds` rơi vào fallback này.

- `useProposalRows` dùng các query hành chính có sẵn: `/administrative/provinces`
  và `/administrative/provinces/{provinceCode}/communes`. Tên lấy từ `fullName`
  của BE, qua formatter hành chính dùng chung; không suy tên từ mã.
- Loader có sẵn kiểm tra datasetVersion, trạng thái hiện hành và quan hệ tỉnh–phường.
  Dữ liệu không khớp, không có đơn vị, lỗi mạng hoặc offline: thông báo không tải
  được tên. Đang tải: thông báo đang tải tên. Không đoán tên từ dataset khác.
- `seedPlaceIds` hiện số địa điểm qua i18n vi/en. Danh sách tên mở rộng là tùy chọn
  của issue, không thêm trong bản sửa này.
- Cả ConfirmationCard và TaskSummary dùng cùng presenter. Không còn fallback
  hiển thị field kỹ thuật/JSON; field mới cần presenter và nhãn i18n rõ ràng.
- Giữ nguyên token, tách view/style và ngân sách. Giá không có không chuyển thành 0.

## Hồi quy

`src/features/__tests__/assistant-proposal-area.spec.tsx`:

- Khôi phục tạm cơ chế cũ (`JSON.stringify`, nhãn field và vòng lặp fallback;
  hai card gọi trực tiếp proposalRows) để chạy 7 test đầu: **7 FAIL**.
  Log có `administrativeArea, {"datasetVersion":"v1",…}` và
  `seedPlaceIds, ["place-a","place-b"]`. Sau đó khôi phục bản sửa.
- Cùng 7 test: **7 PASS** sau sửa. Bổ sung kiểm tra loading và đơn vị trống.
- Bao phủ tên phường/tỉnh từ endpoint thật qua API mock, tỉnh không có phường,
  vi/en và số ít, sai phiên bản, sai tỉnh, lỗi mạng, phần tóm tắt đã lưu,
  không lộ field chưa biết/JSON, không tạo ngân sách 0 từ null.

## Kiểm tra DEV trên thiết bị

**BLOCKED**, chưa nghiệm thu AC3 và chưa kiểm tra một thẻ thật từ DEV.

- iOS: `xcrun simctl list devices booted` không kết nối được CoreSimulatorService,
  sandbox báo `Operation not permitted`.
- Android: SDK có adb nhưng daemon không mở được listener cổng 5037:
  `could not install *smartsocket* listener: Operation not permitted`.

Cần chạy build chứa bản sửa trên iOS và Android, nhận thẻ create_room thật từ
DEV có administrativeArea + seedPlaceIds, kiểm tra tên khu vực chính thức,
"N địa điểm gợi ý", không có JSON/key kỹ thuật. Ghi build, môi trường, proposal
và bằng chứng màn hình cho từng nền tảng trước khi đóng issue.

## Kết quả kiểm tra bản sửa

- `pnpm typecheck`: **PASS**, exit 0.
- `pnpm lint`: **PASS**, exit 0.
- `pnpm test:ui --runInBand`: **PASS**, 237 suites / 3.476 tests / 11 snapshots.
  Gồm 9 test mới của issue này.
- Bằng chứng: [FAIL-before](issue-394-evidence/fail-before.txt),
  [kết quả kiểm tra](issue-394-evidence/validation.txt),
  [SHA-256 nguồn đã kiểm tra](issue-394-evidence/source-sha256.json).
  Đối chiếu lại mã SHA-256 sau kiểm tra: khớp toàn bộ.
- AC1–2 được chứng minh bằng test. AC3 vẫn BLOCKED; chưa đóng issue.
