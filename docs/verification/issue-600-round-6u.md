# #600 round 6u — sảnh gọn hơn và nhóm địa điểm trong wizard

Owner brief 2026-11-12; cơ sở `2fb79e54` (round 6t), thay đổi chưa commit.

- Sảnh dùng key `roomSeeds.body` riêng cho vi/en, bỏ tiền tố không bắt buộc.
  Wizard và các chỗ dùng `createPlaces.body` giữ nguyên nội dung.
- Mô tả sảnh vẫn là `RoomSectionDescription`: bodySmall, text.secondary,
  cách tiêu đề 12pt như Thành viên. Hành động sửa/thêm dùng IconBtn
  plainCompact 20×20 với hitSlop 12pt mỗi phía (44×44), không tăng chiều
  cao tiêu đề. Nút neo vào card cha để hitSlop không bị cắt bởi hàng
  tiêu đề; regression geometry tính cả giới hạn cha vẫn đạt 44×44. Hàng địa điểm có gap 8pt + 12pt chừa nửa nút X, padding
  dưới hàng bằng 0; padding dưới thẻ ngoài vẫn là 16pt.
- Wizard places: “＋ Thêm địa điểm” đứng trên hai nhóm. “Đã chọn (N)”
  ẩn khi rỗng; mỗi thẻ đã chọn dùng X chung của PlaceCardSmall. Địa điểm
  đã chọn bị lọc khỏi danh sách gợi ý, xoá bằng X đưa trở lại danh sách.
- Thẻ gợi ý dùng GhostBtn nhỏ “Thêm”, mục tiêu tối thiểu 44×44 và nhãn
  đầy đủ “Thêm {name} vào danh sách”. Nút chữ là target cùng cấp với
  vùng chạm thẻ, không lồng nút trong nút. Cả hai đều thêm địa điểm;
  đạt giới hạn thì vô hiệu hoá và có lời giải thích. Không tự thêm action
  vào PlaceCardSmall chung; caller của sheet/lobby giữ hành động riêng.
- Các bước type/time/budget/places dùng WizardStepHeader chung:
  title display, subtitle body/secondary, gap 8pt giữa title/subtitle,
  24pt trước control đầu tiên, không thêm margin phía trên title.
  Giữ footer, search scope/filter, pagination và hành vi tạo phòng.

## Kiểm chứng

- FAIL-before: 8 regression cases mới fail trên implementation 6t, đúng ở
  copy/geometry sảnh, nhóm địa điểm và header chung. Các file implementation
  được khôi phục về bản sửa sau lượt đo; không dùng stash.
- Touched Jest specs: PASS — 6 suites, 119 tests (`room-seeds`,
  `room-lobby-feedback`, `create-places`, `round-seven`, `round-four`,
  `place-card-remove`).
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS; 0 errors, 4 warnings có sẵn ở các test
  assistant-keyboard-offset và assistant-usage-footer.
- Full `pnpm test:ui --runInBand`: PASS — 269 suites, 4.361 tests,
  11 snapshots, 221,142 giây. Lượt đầu bắt được assertion padding dọc cũ
  trong round-four; đã cập nhật theo geometry mới (chừa X 12pt ở trên,
  không cần gap dưới).
- `git diff --check`: PASS.

Logs: `/tmp/mobile-600-6u-before.log`, `/tmp/mobile-600-6u-touched.log`,
`/tmp/mobile-600-6u-typecheck.log`, `/tmp/mobile-600-6u-lint.log`,
`/tmp/mobile-600-6u-full-ui.log` (lượt đầu),
`/tmp/mobile-600-6u-full-ui-final.log` (bản sửa cuối).

Chưa nghiệm thu trực quan trên simulator/thiết bị cho round này.
Không commit, stash, push, merge hoặc deploy.
