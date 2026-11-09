# GoGo-MobileApp #561 — xác minh bản đồ và thẻ địa điểm

Ngày: 2026-11-08. Worktree: `mobile-545`. Đang resolve commit #561 `7272036` trên `origin/bugfix/GOGO-564-placecard-regression`, PR #572, HEAD `438daa7`. Phạm vi UI/view-model; không đổi API, dữ liệu, provider, khóa Maps hoặc dependency. Không `git add`, không tiếp tục rebase, không commit/push.

## Nguồn yêu cầu và Stitch

Nguồn Stitch/HTML và điều tra simulator dưới đây được giữ từ commit `7272036`; phiên resolve này kiểm tra code và chạy gate, không tải lại Stitch hoặc chạy simulator.

- [Issue #561](https://github.com/namnh92/GoGo-MobileApp/issues/561): đọc body qua GitHub connector sau khi `gh issue view 561 --repo namnh92/GoGo-MobileApp` không kết nối được `api.github.com` trong sandbox.
- Owner trong task này yêu cầu dùng Light, suy Dark từ role tokens, giữ từng pill một dòng và không thêm nút định vị/phóng to. Đây là chỉ dẫn mới áp dụng cho task #561; không tuyên bố hoàn thành migration Stitch tổng thể từ các phiên trước.
- [Stitch Light](https://stitch.withgoogle.com/u/2/projects/17315762413421369447): screen `f7a74046ae6042ce86d92693901a1a4f`, tên “Tìm địa điểm · Bản đồ · Thẻ địa điểm · Light”. Đọc HTML bằng Stitch MCP `get_screen` → `download_file`, file `ad6ed3313aa2437a8bf26e391161175f`.
- HTML tải về: `/tmp/561-stitch-light.html`, SHA-256 `bbb53c881765e370b8be1e3de4027e621dce097885c29ccfc03e1a9ecd0e952e`. Khung trong HTML là 390×844, dù metadata screen ghi DESKTOP 2560×2048.
- HTML vẽ thumbnail 72×72, thẻ bo 20, cách thanh tab 16, tên một dòng, loại/trạng thái, địa chỉ có pin, hai nguồn rating riêng, bookmark và chevron. Không lấy địa điểm, giờ, giá, ảnh hoặc rating mẫu trong bản vẽ làm dữ liệu app.

## Thay đổi

- Marker không còn `title`, `Callout` hay nội dung tên hiển thị. Tên chỉ giữ làm accessibility label. Marker vẫn dùng mapping taxonomy emoji/generic pin của #527, lớn hơn và dùng accent khi chọn. Memoization và snapshot tracking 100ms được giữ nguyên.
- `toPlaceCard` trước đây bỏ `taxonomies` và không tạo `discovery.categoryLabel` từ kết quả search. Giữ lại taxonomy có sẵn và dùng nhãn từ cache hiện hành; marker/category không còn mất loại trong bước chuyển view-model. Không thêm request hoặc hardcode nhãn.
- Chọn marker hiển thị trực tiếp `PlaceCardSmall` theo owner 2026-11-08 (#564): cùng component với popup kết quả thêm địa điểm và gợi ý khi không có kết quả. List giữ `PlaceCardLarge`. Không có `variant`/`appearance` hoặc layout map riêng. `place-card.view.tsx` và `place-card.style.tsx` giữ nguyên byte theo `438daa7`. Small dùng thumbnail 80×80, địa chỉ một dòng, rating xếp dọc, tags/trạng thái, giá có đơn vị và nút lưu dùng chung; thiếu facts thì ẩn.
- Chạm thẻ mở chi tiết; picker vẫn chọn seed theo luồng hiện có. Bookmark là target độc lập, không mở chi tiết. Chạm bản đồ trống hoặc vuốt thẻ xuống hơn 48pt ẩn thẻ; marker không truyền press thành thao tác bỏ chọn. Accessibility escape cũng ẩn thẻ.
- Map thường có dock bốn đích thật, dùng `GlassBar` và chiều cao chung của app; thẻ cách dock 16pt. Picker/fullscreen giữ luồng cũ, không gắn dock; thẻ cách safe area 16pt. Modal fullscreen có gesture root để swipe hoạt động trên Android.
- Giữ loading/error/offline/list/directions fallback, camera và phân trang hiện có. Khi có thẻ, tiến trình/retry phân trang chuyển lên trên để không che thẻ.

## Dark và điều tra bản đồ xám

Đã kiểm tra adapter, theme, `app.config.ts`, module map-capability và mã SDK `react-native-maps` 1.20.1 đang cài:

- Cả hai nền tảng chọn `PROVIDER_GOOGLE`, sau khi probe native capability. Không có đường Dark đổi provider hoặc đổi map type thành `none`.
- `googleMapStyle(theme.map)` có geometry/roads/water/park/labels, dùng màu RGB opaque `#RRGGBB`; không có `visibility: off`, không đưa màu `rgba(...)` vào JSON của Google. Theme Dark truyền `userInterfaceStyle="dark"`, màu loading và custom style Dark; đổi theme không remount map hay reset camera.
- Config yêu cầu cả hai native Maps keys khi prebuild, không đọc khóa từ JS/extra. Probe iOS xác nhận pod được link, không xác nhận khóa hợp lệ, quyền SDK/bundle, quota hay khả năng tải tile. Không đọc/in giá trị khóa.
- iOS adapter gọi `onMapLoaded` từ `mapViewDidFinishTileRendering`. Timeout 20 giây hiện có vẫn trả về list/directions khi provider chưa load. Test này không chứng minh chất lượng từng tile.
- Thử `rtk xcrun simctl list devices booted` lúc 19:40 +07 bị sandbox chặn: `CoreSimulatorService connection became invalid`, log path `Operation not permitted`, `Unable to locate device set`. Không đổi permission, restart service hay thử đường vượt sandbox.

**Kết luận:** chưa tìm thấy lỗi style JSON/provider trong cấu hình app giải thích nền xám; nguyên nhân live vẫn **UNKNOWN/BLOCKED**. Không đổi provider, khóa hay style theo phỏng đoán, không tuyên bố đã sửa tile. Cần kiểm tra trên build thực chứa patch: tải tile Light/Dark ở cùng camera, chuyển theme, xem diagnostic SDK đã loại khóa/PII và xác minh quyền SDK/bundle/network khi cần. Chưa có ảnh app so cạnh Stitch; không tuyên bố pixel parity hoặc nghiệm thu simulator.

## Bảng lệch và mục cần owner quyết

| Mục | Xử lý / lý do |
| --- | --- |
| Layout card map của Stitch | Owner 2026-11-08 (#564) chốt đúng hai component. Map dùng nguyên `PlaceCardSmall`: thumbnail 80×80 thay vì 72×72, radius 16 thay vì 20, địa chỉ không pin, không chevron, rating xếp dọc trong phần nội dung. Không thêm layout thứ ba. |
| Stitch cho chữ trong pill GoGo bị gãy dòng | Giữ `RatingChips compact stacked` của Small; mỗi nguồn/count vẫn là một pill `numberOfLines=1`. Chưa đo fit trên thiết bị hẹp. |
| Không có Stitch Dark | Dùng cùng nội dung/layout Light và role tokens Dark + Dark map style hiện có, theo task của owner. Chưa có đo parity với bản vẽ Dark. |
| Nút “Định vị của tôi” | **owner to decide** — không thêm. Không thay hành vi quyền vị trí/GPS hiện có. |
| Nút “Phóng to” (+) | **owner to decide** — không thêm nút custom của Stitch. Giữ pinch/zoom native hiện có. |
| Marker line icon trắng + halo nhấp nháy trong Stitch | Giữ mapping/icon và cache #527 theo task; selected lớn hơn, accent. Không thêm halo/animation lặp. |
| Bookmark 36pt và tab bar 62pt của Stitch | Dùng target bookmark 44pt và chiều cao tab chung 50pt + safe area của app. Không giảm target dưới chuẩn accessibility. |
| Số liệu/ảnh mẫu hoặc facts API không có | Không chép mẫu; ẩn fact không có. Ảnh dùng placeholder chung; credit/author ảnh thật vẫn giữ. |
| Nền tile xám / ảnh so sánh Light+Dark | BLOCKED do không truy cập được CoreSimulator trong sandbox; chưa xác nhận nguyên nhân hay kết quả live. |

## Resolve và kiểm thử trên nền #564

| File:line | Resolution / hành vi |
| --- | --- |
| `src/features/search/search.view.tsx:181` | Giữ dismiss gesture; dòng 256 render `PlaceCardSmall`, lưu độc lập, accessibility label/hint, tap mở detail hoặc chọn seed trong picker. |
| `src/features/search/search.style.tsx:21` | Giữ pagination phía trên khi có card; không thêm style card. |
| `src/shared/ui/place-card.view.tsx:17` | Giữ nguyên shared parts của `438daa7`, bỏ toàn bộ map composition cũ. |
| `src/shared/ui/place-card.style.tsx:4` | Giữ nguyên styles của `438daa7`, không còn mapCard/mapPhoto/mapSave. |
| `src/features/__tests__/design-drift-home-search.spec.tsx:653` | Light/Dark kiểm Small, facts, save, empty-map/short swipe/down swipe, navigation; regression picker/fullscreen/viewport dùng card thay callout. |
| `src/shared/ui/__tests__/place-card.spec.tsx:321` | Small 80×80, facts/rating một dòng, actions và ẩn facts thiếu ở hai theme. |
| `src/shared/ui/map-canvas.view.tsx:93` | Giữ marker không nhãn, accent/size khi chọn, cache; empty-map deselect dòng 211. |
| `src/features/__tests__/map-canvas.spec.tsx:257` | Không title/callout/text; phân biệt marker press; giữ Light/Dark/style switch không remount. |
| `src/features/search/search-map-panel.view.tsx:58` | Gesture root cho modal fullscreen. |
| `src/shared/api/view-models.ts:99` | Giữ taxonomy/category qua view-model; test tương ứng `view-models.test.ts:41`. |
| `src/shared/ui/app-tab-dock.view.tsx:12` | Dock bốn đích navigation thật. |

Focused UI: PASS, exit 0, 5 suites / 241 tests / 1 snapshot, `/tmp/561b-focused-ui.log`. Bao gồm enforcement #564, marker adapter, Search integration, shared card và fullscreen map panel. Enforcement không đổi.

| Lệnh bắt buộc | Kết quả | Log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/561b-typecheck.log` |
| `pnpm lint` | PASS, exit 0 | `/tmp/561b-lint.log` |
| `pnpm test` | FAIL, exit 1: 3 failed / 1.657 passed / 39 skipped; 138 files passed / 1 failed / 1 skipped | `/tmp/561b-test.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 210 suites / 2.848 tests / 9 snapshots | `/tmp/561b-test-ui.log` |

Ba lỗi Vitest ở `src/shared/config/__tests__/distribute-wrapper.test.ts`: `refuses while the owner is alive` (dòng 208), `refuses recovery while a recorded build process group is still alive` (234), `keeps the lock and run files when a recorded build group is still alive after the child exits` (258). Diagnostic trực tiếp `ps -o lstart= -p <self>` bị `EPERM`; wrapper và test đều khớp byte với HEAD `438daa7` (`/tmp/561b-baseline-diagnostic.log`). Đây là giới hạn kiểm tra process của sandbox; không đổi wrapper/test hoặc bỏ qua test. Full Vitest chưa xanh.

`git diff HEAD --check`: PASS. Hai file shared card khớp byte với HEAD; không sửa enforcement.

Working tree vẫn có index unmerged vì owner yêu cầu không `git add`/`rebase --continue`; conflict markers đã resolve trong file. Kết quả gate thuộc nội dung working tree này, không phải commit rebase mới hoặc nghiệm thu thiết bị.
