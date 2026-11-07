# GoGo-MobileApp #531 — Đã lưu theo thành phố

Ngày 2026-11-08. Giữ patch chưa commit của lượt trước; không commit/push.

## Nguồn đã đọc

Stitch MCP `get_screen`, rồi `download_file` cho cả HTML và screenshot:

- Project `17315762413421369447`, screen `5cd4c60b8f2e4236bb8d8b577befd489`, “Đã lưu · Thành phố - GoGo”.
- HTML `024b8300a7414b7f96fc3fed8f54df7e`, bản nguyên văn: [GOGO-531-source.html](GOGO-531-source.html).
- Screenshot `d694d317c210424e831dbb1f0c0f7283`, đã tải và xem. Khung xuất 2560×8578, cột điện thoại tối đa 430px.
- [Owner 2026-11-08, comment 6711023700](https://github.com/namnh92/GoGo-MobileApp/issues/531#issuecomment-6711023700), đã đọc qua GitHub connector.

## Thay đổi

`Tất cả ›` giữ luồng push `/saved/city/[provinceCode]` bằng mã thành phố;
Saved overview giữ nguyên danh sách và vị trí cuộn. City dùng tên/count thật,
subtitle, nút quay lại và chuông chung, nhóm phường với count, toàn bộ card trong
thành phố, và bốn tab điều hướng có tab Đã lưu đang chọn. Direct link giữ Home
fallback. Count ẩn trong lúc chưa có kết quả tin cậy.

Cả Saved chính và city bỏ menu ⋮/Sheet. `PlaceCard` dùng bookmark chung,
đang lưu = tô đầy, bấm gọi ngay `useToggleSaved({ saved: true })`.
Mutation hiện có xóa lạc quan và khôi phục đúng entry/metadata khi DELETE lỗi;
không thêm bản sao state cục bộ. Success live region và ResultSheet lỗi giữ nguyên.
“Tìm quán tương tự” chỉ còn là control riêng của card đóng/không khả dụng,
với category và administrative scope thật; không có control này trên card
bình thường. Entry mất toàn bộ detail vẫn có cách bỏ lưu.

Saved appearance của PlaceCard chung có ảnh cao 176, góc 16, body 14,
hours/category/distance trên scrim ở đáy ảnh, tên rồi địa chỉ, Google/GoGo riêng,
tag và giá/unit ở hàng dưới. Missing facts bị ẩn. Credits ảnh có nguồn tiếp tục
hiện. Không thay layout Discovery/default. Màu, kiểu chữ và geometry dùng token;
Light/Dark dùng cùng cây component. Không đưa dữ liệu mẫu Stitch vào app.

Không đổi API/schema. Route vẫn trong allowlist telemetry; không đưa params vào
tags. Dùng instrumentation save/search hiện có. Không có migration dữ liệu;
rollback bằng cách bỏ patch này.

## Bảng lệch và việc chưa xác minh

Theo `stitch-design.md §0`, chưa được báo **Khớp Stitch 100%**.
Bảng workspace `dev/handoffs/mobile-redesign-stitch-map.md` nằm ngoài writable
roots và là file sinh tự động; ghi bằng chứng ở worktree này để cập nhật sau.

| Điểm | Trạng thái / căn cứ |
| --- | --- |
| ⋮ → bookmark 44pt dùng chung | Ngoại lệ đã duyệt: owner 2026-11-08, comment 6711023700. |
| Tên/count/ảnh/ratings/hours/tags/giá khác dữ liệu minh họa | Chỉ dùng dữ liệu BFF thật; thiếu thì ẩn, theo §0.1. Giá luôn có unit. Unread dot chỉ hiện khi có unread thật. |
| Credits ảnh và trạng thái không khả dụng | Giữ yêu cầu owner 2026-11-07 đã ghi ở PR-g04-saved.md; không bỏ attribution hay trạng thái lỗi để giống dữ liệu mẫu. |
| Font | **Chưa khớp, chưa có ngoại lệ duyệt:** HTML dùng Plus Jakarta Sans; app hiện nhúng Inter. Thử tải font thất bại: DNS `Could not resolve host: raw.githubusercontent.com`; không thêm asset giả hay gọi đây là tương đương. |
| Đối chiếu ảnh Light/Dark | **BLOCKED**, 0/1 màn có đủ cặp app ↔ Stitch. `simctl list devices booted` exit 1: CoreSimulatorService connection invalid/refused và log `Operation not permitted`. Chưa có ảnh app đặt cạnh Stitch; chưa có Dark Stitch tương ứng được xác minh. |

## Kiểm tra

- `pnpm typecheck`: PASS, exit 0; `/tmp/mobile-531-typecheck.log`.
- `pnpm lint`: PASS, exit 0; `/tmp/mobile-531-lint.log`.
- `pnpm test`: 134 suites pass, 1 skipped; 1 suite fail với đúng 3 tests
  process-liveness trong file không sửa `distribute-wrapper.test.ts` (208/234/258).
  1.573 tests pass, 39 skipped. Xác minh trực tiếp: `spawnSync ps` trả `EPERM`,
  `pgrep` không lấy được process list (`sysmond service not found`). Đây là giới
  hạn sandbox, không sửa/skip test để làm xanh. Log `/tmp/mobile-531-test-final.log`.
- Focused Saved / PlaceCard / saved mutation: PASS, 109 tests;
  `/tmp/mobile-531-focused-final.log`. Bao gồm bookmark filled, không mở card khi
  bỏ lưu, lỗi mutation, optimistic removal/rollback đầy đủ metadata, scope của
  standalone similar search, count/subtitle, tab navigation, city state matrix.
- `pnpm test:ui --runInBand`: PASS, exit 0; 193 suites / 2.340 tests.
  Log `/tmp/mobile-531-ui-final.log`. Layout/icon cuối cùng được kiểm tra lại
  bằng focused run 109 tests nêu trên.
- `git diff --check`: PASS.

Không claim native visual acceptance hoặc DEV/backend acceptance.

## PR #532 — sửa Astra r1 F-01 (2026-11-08)

Base `c9043b3`, HEAD giữ nguyên `a60c154`; patch chưa commit/push.
`GlassBar` nay bao cả hàng tab và padding safe area của dock thành phố.
Material và wash phủ toàn bộ dock thay vì nằm trong một sibling rỗng chỉ cao
bằng hairline. Không đổi primitive dùng chung hoặc geometry của hàng tab.

Đã kiểm tra các màn trong diff và toàn bộ caller `GlassBar`:

- Saved overview dùng navigator chung với Home/Plans/Profile: background có
  absolute fill, chiều cao gồm `TAB_BAR_HEIGHT + insets.bottom`.
- City là caller duy nhất có glass rỗng không có fill sizing. Các action bar
  và composer còn lại có children định kích thước; không thấy cùng lỗi collapse.

Regression trong `saved-areas.spec.tsx` dùng `GlassBar` thật, kiểm tra iOS blur
và Android wash: material fill cùng dock với bốn tab, safe area 34pt, chiều cao
hàng tab, tab Đã lưu selected và điều hướng Home. Assertion material/dock đỏ
trước sửa, xanh sau sửa; focused suite 26/26 PASS. Jest không đo native pixels;
chưa xác minh lại screenshot trên thiết bị/simulator.

Log lượt này ở `/tmp/mobile-532-{typecheck,lint,test,ui}.log` và
`/tmp/mobile-532-regression-{before,after}.log`.

- `pnpm typecheck`: PASS, exit 0.
- `pnpm lint`: PASS, exit 0.
- `pnpm test`: exit 1; 134 suites / 1.573 tests PASS, 1 suite / 39 tests
  skipped, 3 tests FAIL trong `distribute-wrapper.test.ts` (208/234/258).
  Test và script distribution không đổi so với HEAD. Probe trực tiếp xác nhận
  `spawnSync('ps', ...)` bị `EPERM`, `pgrep` exit 3: `Cannot get process list`
  / `sysmond service not found`. Không bỏ qua hoặc sửa test để né sandbox.
- `pnpm test:ui --runInBand`: PASS, exit 0; 193 suites / 2.342 tests.
- `git diff --check`: PASS.
