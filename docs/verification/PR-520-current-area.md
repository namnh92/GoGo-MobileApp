# PR #520 — Bộ chọn khu vực dùng chung

Ngày: 2026-11-07. Nền: `994faff`; phần tiếp tục là thay đổi chưa commit trong worktree `mobile-520`. Không commit/push.

## Nguồn Stitch và giới hạn xác minh

Đọc trực tiếp canvas/preview của [Chọn khu vực - GoGo](https://stitch.withgoogle.com/u/2/projects/17315762413421369447?node-id=12437d2c4f4d415bbd29d6dbae0defe5), project `17315762413421369447`, screen `12437d2c4f4d415bbd29d6dbae0defe5`. Preview được chọn trên Chrome hiển thị khung 390 × 932, bottom sheet trên nền Home; trạng thái chưa chọn tỉnh, phường bị khóa, hint và nút xác nhận bị khóa. Accessibility tree xác nhận đúng screen ID qua attachment của prompt mới nhất.

**FAIL parity — không có cặp Stitch Light/Dark riêng để đối chiếu.** Owner yêu cầu Light theo Stitch, Dark theo night tokens, ghi FAIL khi thiếu Stitch Dark. Có một bất nhất nguồn cần giữ rõ: preview live thực tế đang dùng màu tối (cả lịch sử sửa trên Stitch gọi là Dark mode). Bản app giữ cấu trúc/copy của nguồn này, áp semantic tokens cho Light và bộ night hiện hữu cho Dark. Không coi màu Light là đã được nguồn Light độc lập xác nhận. Không sửa hay sinh màn Stitch.

Connector Stitch không được expose trong phiên này. Helper read-only không chạy được vì `STITCH_API_KEY` không có trong environment; đọc bằng UI Chrome thay thế. Không có HTML export hay phép đo pixel. **Chưa xác minh hình ảnh app cạnh Stitch trên simulator/device: 0/1 màn.** Không tuyên bố khớp hình ảnh 100% hoặc DEV acceptance.

## Stitch → app

| Stitch live | App |
| --- | --- |
| Bottom sheet, backdrop tối, grabber, đóng bằng X | `CurrentAreaSheet` dùng `Sheet` animated chung, `swipeToClose`, giữ reduced motion, Android back, backdrop và accessibility escape |
| Tiêu đề “Chọn khu vực”, nút đóng tròn | Header shared, `introSection`, IconBtn tròn; vùng chạm có hit slop |
| “Dùng vị trí hiện tại”, nút surface trung tính + pin màu nhấn | `SecondaryBtn variant="area"`, icon location, trạng thái loading/disabled chung |
| “Tỉnh/Thành phố”, “Chọn Tỉnh / Thành phố”, chevron | `AdministrativePicker embedded`; tỉnh từ API/cache, không copy danh sách mẫu |
| “Phường/Xã”, “Chọn Phường / Xã”, chevron; khóa khi chưa có tỉnh | Query phường theo mã tỉnh, đổi tỉnh xóa phường cũ; trường disabled trước khi chọn tỉnh và khi dataset cũ |
| Hint “Vui lòng chọn Tỉnh / Thành phố trước” + bolt | Hint dưới phường khi chưa chọn tỉnh, dùng accent soft/text tokens |
| “Xóa khu vực” và “Xác nhận” cùng hàng, tỉ lệ 1:2 | Footer shared, gap 12, flex 1:2; nút xác nhận khóa khi rỗng, thiếu version hoặc dataset đã đổi |
| Chọn tỉnh/phường qua dropdown | Danh sách tìm theo tên trong chính Sheet, có nút quay lại; không xếp chồng native Modal. Nguồn chưa hiển thị thiết kế danh sách mở, nên giữ danh sách administrative hiện hữu |
| Màu theo theme | Không thêm màu literal; `redesign.*`, surface/border/accent semantic tokens, Dark dùng bộ night hiện hữu |

Copy mới có vi/en. Các nhãn tỉnh/phường là dữ liệu hành chính từ BFF, không phải sample Stitch. Nút giữ pressed feedback cả khi reduced motion tắt scale.

## Entry points và dữ liệu

- Home: dòng location hiện hữu (`home-location`, pin + khu vực + chevron) và CTA fallback mở shared sheet qua compatibility export `DiscoveryLocationSheet`.
- Search: dòng khu vực mở cùng sheet. Bộ lọc có nút mở sheet; chờ `Sheet.onClosed` của bộ lọc trước khi mở modal khu vực, tránh lỗi presenter iOS. Giữ nguyên keyword và filters.
- Create-room location: thay picker inline bằng nút khu vực mở cùng shared sheet. Màn theo dõi app store, cập nhật mã hành chính/position của draft và giữ quy tắc position/area loại trừ nhau. CTA GPS hiện hữu vẫn gọi cùng controller; chip mặc định tài khoản vẫn là thao tác prefill có chủ ý.
- Saved và các consumer scope tiếp tục theo dõi store của branch; không cần thêm picker riêng.
- Account home-area editor chỉnh **mặc định tài khoản**, là dữ liệu profile có Save riêng; không phải current-area switch. Giữ target/semantics profile, dùng chung nguồn administrative, không biến thao tác sửa profile thành đổi current-area ngoài ý muốn.
- Map “Tìm khu vực này” là scope viewport tạm thời theo hành vi hiện hữu, không thay current area.

`CurrentAreaSheet` đọc/ghi `useAppAreaStore`, không tạo store mới. Chọn province/ward mới chỉ đổi draft; Xác nhận commit vào store và đóng sheet. Đóng X/backdrop/back/swipe bỏ lựa chọn chưa xác nhận. “Xóa khu vực” là hành động clear ngay trên store (và secure storage), để nút xác nhận trở lại disabled đúng nguồn. Chọn lại dùng cùng cơ chế persist của branch; không persist tọa độ.

“Dùng vị trí hiện tại” gọi `useCurrentLocation.request` → controller singleton: một lần resolve rõ ràng cho mỗi thao tác, các thao tác đồng thời được deduplicate, locate được invalidate khi explicit. Không gọi GPS khi mở picker. Thành công áp dụng scope GPS và đóng; từ chối/lỗi giữ sheet với thông báo và picker thủ công. Callback không đóng sheet đã bị dismiss/unmount trong khi request chờ.

API/cache hiện hữu: `/administrative/version`, `/administrative/provinces`, `/administrative/provinces/{provinceCode}/communes`; snapshot phân trang qua `loadAdministrativeSnapshot`. Không thay contract, không thêm dependency, không tạo admin fixture trong production.

## State matrix và regression

| State | Kết quả |
| --- | --- |
| Chưa chọn | Placeholder đúng copy, phường disabled, hint, confirm disabled |
| Chọn province/ward | Tìm không dấu, mã/version chuẩn, đổi tỉnh xóa phường, chọn toàn tỉnh vẫn được |
| Loading | LoadingState tại version/list; nút GPS giữ nhãn + spinner khi request |
| Empty | EmptyState khi API list rỗng hoặc search không khớp |
| Error | ErrorState + retry version/list, không bị spinner vô hạn |
| Offline, chưa cache | OfflineState sau tín hiệu offline; confirm không chấp nhận thiếu version |
| Offline, có cache | Chọn từ snapshot cache vẫn commit được |
| Permission denied/unavailable | Thông báo rõ, không ép đăng nhập, picker thủ công vẫn hoạt động |
| Dataset thay đổi | Hiện cảnh báo, khóa ward/confirm cho đến khi chọn lại province |
| Clear/cancel/reopen | Clear xóa store; cancel không commit draft; reopen đọc current store |

Các test mới ở `current-area-sheet.spec.tsx` render component thật với mock ở query boundary; test location public kiểm tra permission/GPS và manual fallback; test create giữ invariants draft; test Home/Search mở chung sheet; test filter chuyển modal qua lifecycle đóng. Các test controller hiện hữu kiểm tra persist qua launch, publish tới mọi subscriber, deduplicate, không re-resolve khi permission không đổi và cache locate không persist.

## Kết quả kiểm tra

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test:ui --runInBand --silent` | PASS — 175 suites, 2.076 tests |
| `pnpm test` | BLOCKED — 1.320 PASS, 39 skipped, 3 FAIL do process inspection trong sandbox |
| `pnpm test --exclude src/shared/config/__tests__/distribute-wrapper.test.ts` | PASS — 113 files, 1.297 tests, 39 skipped; loại đúng suite bị sandbox chặn, không phải full-green verdict |
| `git diff --check` | PASS |

Full `pnpm test` bị BLOCKED bởi sandbox ở ba case `distribute-wrapper.test.ts`: `ps` bị `EPERM`; `pgrep` báo `Cannot get process list` / `sysmond service not found`. Test và script distribute không đổi trong patch. Không sửa hoặc bỏ assertion để làm xanh giả.

Rollback: revert phần thay đổi chưa commit này, giữ controller/store của `994faff`; không có migration dữ liệu.

## Bổ sung owner 2026-11-07 — cache dữ liệu hành chính

Nền kiểm tra của bổ sung này: HEAD `8c2faf0`, patch chưa commit trong worktree `mobile-520`.

- Startup chờ `PersistQueryClientProvider` restore xong rồi bắt đầu kiểm tra `/administrative/version` cùng với resolve khu vực. Mỗi process chỉ khởi động một lần kiểm tra tự động, kể cả khi có lựa chọn thủ công đã lưu hoặc GPS thành công. Không tự retry khi version lỗi; retry từ UI vẫn là thao tác tường minh.
- Các consumer version chỉ observe cache; mount, focus, reconnect và mốc 5 phút không tạo thêm lần kiểm tra. Nếu mở app offline, lần kiểm tra startup chờ mạng mà không chặn hydrate khu vực từ cache.
- Dùng chung query options cho snapshot fallback và picker: `['administrative', datasetVersion, 'provinces']` / `['administrative', datasetVersion, provinceCode]`, `staleTime` và `gcTime` vô hạn trong bộ nhớ. Giữ prefix persisted `administrative`, AsyncStorage key `gogo.query-cache`, cache buster và `maxAge` 24 giờ hiện hữu; cache hết hạn hoặc logout vẫn bị xóa theo policy chung.
- Regression dùng persister AsyncStorage thật với storage stub, save cache, bỏ QueryClient/module cũ, restore sang QueryClient/module mới. Khi version không đổi, relaunch chỉ gọi `/administrative/version`, không gọi provinces/communes. Có thêm case version đổi, lựa chọn thủ công không gọi GPS, offline và explicit retry sau lỗi.
- Bằng chứng trước/sau: ba regression startup/relaunch FAIL trên `app-area.ts` của HEAD cũ (thiếu request version ở relaunch/manual, dùng version cũ khi cache còn fresh); PASS trên patch. Suite focused location: 6/6 PASS. Hai UI test về restore gate và version qua remount/focus/reconnect/explicit retry: 2/2 PASS.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: PASS. `pnpm test --exclude src/shared/config/__tests__/distribute-wrapper.test.ts`: PASS — 114 files, 1.302 tests, 39 skipped.
- `pnpm test:ui --runInBand --silent`: PASS — 176 suites, 2.077 tests.
- Full `pnpm test`: BLOCKED bởi cùng ba case process inspection trong `distribute-wrapper.test.ts` (lần full run: 1.323 PASS, 39 skipped, 3 FAIL; trước khi thêm hai case offline/retry). Không sửa test/script distribute, không coi run loại suite này là full-green.

Rollback bổ sung: bỏ patch chưa commit trên nền `8c2faf0`; không đổi dependency, API contract hay format persisted data. Không install/commit/push.
