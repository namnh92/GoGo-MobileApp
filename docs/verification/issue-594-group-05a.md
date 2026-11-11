# GoGo-MobileApp #594 — nhóm 05A Tạo kèo

Ngày: 2026-11-10 (Asia/Ho_Chi_Minh). Nhánh: `feature/GOGO-594-redesign-g05a-create`; base `c48d501`. UI-only, ngoại lệ location prefetch theo owner 2026-11-11; không commit/push.

**Trạng thái: đã sửa UI, chưa đạt acceptance “Khớp Stitch 100%”.** Đã đọc HTML và ảnh bằng Stitch MCP cho 9/9 màn. Chưa có ảnh app đối chiếu: `xcrun simctl list devices booted` thất bại vì CoreSimulatorService/notification subscription bị sandbox từ chối. Số màn so ảnh app cạnh Stitch ở cả hai theme: **0/9**. Không suy ra pixel parity từ component tests.

Issue đọc qua GitHub connector sau khi `gh issue view 594 --repo namnh92/GoGo-MobileApp` báo không kết nối được `api.github.com`.

## Nguồn và ghi chú từng màn

Project `17315762413421369447`. Round 1 đã gọi `get_screen` và `download_file` cho HTML và screenshot của từng ID dưới đây. `list_screens` chỉ có hai màn mang tên Dark (`Bảng màu`, `Bạn đang muốn gì hơn`), không có Dark cùng tên của nhóm 05A. **Owner 2026-11-10:** màn không có Stitch Dark dùng bộ AppToken Light/Dark toàn app; wizard giữ một màn riêng cho mỗi bước; 5.1 single-form **not built as a screen — owner 2026-11-10**, chỉ làm tham chiếu visual. Đây là quyết định đã chốt, không phải deviation cần duyệt lại. Không tạo/sửa màn trên Stitch. Không có cặp nguồn Light/Dark để chạy `parity.py`: **0/9 cặp nguồn đo được**, không báo PASS thay cho nguồn thiếu.

| Màn | Stitch ID | Light: phần đã áp dụng | Dark |
| --- | --- | --- | --- |
| 5.1 Tạo phòng hẹn | `11616575349645775674` | Chỉ tham chiếu visual cho bước hiện hữu; not built as a screen — owner 2026-11-10. | Không dựng màn riêng; phần tử dùng chung dùng AppToken Light/Dark toàn app (owner 2026-11-10); chưa so ảnh. |
| 5.2 Đối tượng | `12897203841795461814` | Tiêu đề, mô tả, hai thẻ icon + trạng thái chọn, input tên và counter, CTA dùng chung. Giữ maxLength 80. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng copy/layout; chưa so ảnh. |
| 5.3 Chế độ nhóm | `6534318264704160088` | Tiêu đề, mô tả, lưới bốn chip quy mô, bộ đếm chính xác, nội dung cuộn. Giữ 3–12 người và hai lựa chọn budgetMode hiện hữu. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng copy/layout; chưa so ảnh. |
| 5.4 Địa điểm | `10366405716754660736` | Tiêu đề, mô tả, thẻ GPS, chip bán kính dùng chung, chọn khu vực qua sheet hiện hữu, CTA. GPS prefill từ startup và silent refresh mỗi focus; shared SearchField mở sheet khu vực; giữ permission/fallback/version validation (owner 2026-11-11). | AppToken Light/Dark toàn app (owner 2026-11-10), cùng trạng thái GPS/khu vực; chưa so ảnh. |
| 5.5 Thời gian | `14694142646341612511` | Lịch nội tuyến tuần/tháng, đổi tháng, giờ bắt đầu và wheel giờ khác (owner 2026-11-11). Dòng tổng kết vẫn mở sheet chọn tạm; giữ giờ kết thúc và duration preset. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng lịch/ngày giờ được tính lúc chạy; chưa so ảnh. |
| 5.6 Chọn ngày giờ | `6910860286766835350` | Sheet hiện hữu có lịch tuần/tháng, giờ, summary và wheel giờ khác (owner 2026-11-11). Huỷ trái/Xong phải dùng `SheetActions`; Huỷ giữ nguyên draft trước khi mở. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng validation/past-slot state; chưa so ảnh. |
| 5.7 Ngân sách | `9352497074123873706` | Thẻ tier, scope chỉ còn trong subtitle (owner 2026-11-11), số tiền VND đầy đủ, đơn vị trên từng mức và profile prefill, chọn có check. Không thay tier/default/amount. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng scope và đơn vị; chưa so ảnh. |
| 5.8 Mood & Tạo phòng | `7359368928226437041` | Tiêu đề, checkbox taxonomy theo API dùng chung với contribution wizard (owner 2026-11-11), seed chỉ hiện tên thật và nút bỏ, thêm địa điểm qua route cũ. Skeleton/error/offline/empty rõ ràng; CTA/loading dùng chung. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng dữ liệu và trạng thái; chưa so ảnh. |
| 5.9 Thoát tạo kèo? | `18282881640925513825` | Sheet icon/tiêu đề/mô tả; đủ ba hành động dùng chung, một hàng bằng nhau, save là primary. Dùng nguyên promise/handlers của `useDialog`. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng save/discard/continue; chưa so ảnh. |

`AppHeader` vẫn giữ chức năng hiện hữu; save/close chuyển sang icon có nhãn truy cập, mục tiêu 48pt để chừa chỗ cho tiêu đề. Progress tính đúng 5 bước couple hoặc 6 bước group. Button sử dụng biến thể/kích thước chung; không thêm pressed highlight. Không thêm màu hex/rgba hay palette của màn; typography lấy token.

## Bảng lệch

Các dòng dưới đây là phần chưa giống nguồn hoặc cần quyết định; **không coi là owner đã chấp thuận** chỉ vì được ghi ở đây. Không mở BE issue theo chỉ dẫn task.

| Stitch element | Screen | Reason | Proposal |
| --- | --- | --- | --- |
| Header “Create Room Occasion/Location/Schedule/Budget/Preferences” và avatar | 5.2–5.8 | Header mẫu không dùng copy i18n của app; avatar trong thiết kế không có chức năng trong wizard hiện hữu. Task yêu cầu AppHeader và không đổi navigation/auth. | Giữ AppHeader i18n, notification/save/close hiện hữu. Owner xác nhận mapping header khi xem ảnh. |
| Bước luôn `/6` | 5.2–5.8 | Luồng couple không có group-setup nên thực tế 5 bước. | Giữ count theo route hiện hữu, không thêm bước chỉ để giống số mẫu. |
| Tên kèo 40 ký tự | 5.2 | Validation hiện hữu và createRoom OpenAPI cho phép 80 ký tự (`openapi/gogo.v1.yaml:744`). Task yêu cầu giữ validation. | Giữ input/counter `/80`; thay limit cần task hành vi riêng. |
| Thẻ “Gợi ý từ GoGo”, ảnh/quán Thảo Điền | 5.2 | Dữ liệu minh hoạ không có trong nguồn dữ liệu màn; không có cơ chế recommendation card hiện hữu tại bước này. | Ẩn dữ liệu mẫu. BE proposal nếu owner muốn: “BFF trả gợi ý khi tạo phòng theo audience/khu vực, gồm PlaceSummary thật, nguồn ảnh, freshness; không trả giá/rating thiếu unit/source; có empty/error contract.” |
| Ba chip gợi ý tên kèo | 5.2 | Chưa có action/preset được nối trong flow; không tự thêm chức năng theo thiết kế. | Owner xác định copy và hành vi fill/replace tên trong task riêng. |
| Match/Vote/Host, badge/benefit/time-to-decide | 5.3 | Flow hiện gửi couple=match/group=vote trong `toCreateRoomBody`; thêm lựa chọn sẽ đổi logic. OpenAPI có enum nhưng mô tả group chỉ vote/host, khác group Match trong Stitch (`openapi/gogo.v1.yaml:739`). | Owner chốt matrix rồi task hành vi riêng. Nếu muốn group Match: BE issue proposal “Làm rõ/đồng bộ createRoom decisionMode cho group; AC contract + validation + matching/voting semantics + regression.” |
| Counter có thể tới 30 theo script thiết kế | 5.3 | UI hiện giới hạn 3–12; OpenAPI maximum 20. Task cấm đổi validation. | Chip >10 chọn 12; giữ stepper 3–12. Owner giải quyết khác biệt 12/20/30 trong task hành vi riêng. |
| Back button phụ ở footer | 5.3 | Back đã ở AppHeader; footer hiện chỉ có Continue. | Giữ chức năng back hiện hữu; owner xác nhận có cần thêm nút back thứ hai ở footer. |
| Tabs Vị trí hiện tại/Bất kỳ đâu và slider 1–20km | 5.4 | Hiện “Bất kỳ đâu” là radius null của GPS; có các lựa chọn 2/5/10km/null. Tab mới có thể đổi semantic location; slider liên tục mở tập giá trị mới. | Giữ các lựa chọn hiện hữu bằng shared Chip; owner chốt thay đổi control/value range riêng. |
| Map, ~42 quán hợp gu, Đang mở cửa | 5.4 | Không có map/coverage result trong query của bước này; count và open status trong Stitch là mẫu. Không suy luận từ GPS. | Ẩn. BE proposal: “BFF coverage preview theo origin/radius/room constraints; trả count thật, thời điểm tính, phạm vi và unknown/degraded; không giả định mọi quán đang mở.” |
| Hai quận/phường, thêm/xoá nhiều khu vực | 5.1, 5.4 | RoomConstraintInput chỉ có một administrativeArea; app dùng dataset version + province/commune, không phải danh sách quận. | Giữ CurrentAreaSheet đơn chọn và fallback GPS. BE proposal: “Thiết kế multiple administrative scopes cho room constraint, validation dataset version, union/intersection semantics, compat một vùng và regression search.” |
| Địa chỉ Nguyễn Huệ/Bến Nghé, TP.HCM, mô tả chống kẹt xe/Sài Gòn | 5.4 | Chưa có dữ liệu thật tại render và không có bảo đảm route/traffic tương ứng trong chức năng bước này. | Chỉ hiện GPS/area label thật. Owner chốt copy trung tính; không tạo địa chỉ/traffic claim. |
| Ngày 7/11, tháng 11/2026, 19:00 cố định và ảnh “Khung giờ vàng” | 5.5–5.6 | Là sample date/time và editorial card chưa có nguồn/chức năng. | Dùng lịch thật, ngày/giờ draft và quy tắc schedule; ẩn editorial card mẫu. |
| Tab “Tính theo người” trong couple budget | 5.7 | Couple luôn TOTAL phòng; thêm tab sẽ đổi invariant/conversion. | Chỉ hiện scope của room thật. Per_person/total vẫn do bước group-setup chọn, không thêm toggle couple. |
| Tier mặc định/“Gợi ý nhiều nhất”, ảnh/copy menu thông minh | 5.7 | Default tier hiện là to800; tier label có thể trình bày lại nhưng không có nguồn chứng minh độ phổ biến hay gợi ý menu. | Giữ default/amount hiện hữu, không gắn badge/ảnh/claim mẫu. |
| Giá không kèm unit | 5.7, 5.8 | Vi phạm core.md 13, kể cả range ngân sách. | Mỗi tier có `/ cả phòng (2 người)`, `/người` hoặc `tổng nhóm` theo room; unknown price không hiện. |
| Mức chi “Đã khoá” thay cho taxonomy spending_style | 5.8 | Flow hiện có taxonomy spending_style độc lập với budget tier; thay field bằng locked amount sẽ bỏ hành vi hiện hữu. | Giữ taxonomy thật, không tạo fake locked-price row. Owner xác nhận mapping và task chức năng riêng nếu cần đổi. |
| Seed card ảnh/verified/rating/giá/địa chỉ Mơ Concept | 5.8 | Seed draft chỉ có id/name; không được bịa metadata hoặc đổi data model để lấp thiết kế. | Chỉ hiện tên thật + bỏ chọn. Follow-up: kiểm tra tái dùng PlaceSummary/detail hiện có trước khi đề xuất BE; nếu thiếu, BE proposal “Seed place summary có verified provenance, source/sample count rating, ảnh và price+unit nullable; dùng chung PlaceCard, omit unknown.” |
| Tối ưu vote bằng AI, “30 giây”, Zalo/Messenger | 5.8 | Không có chức năng/bảo đảm tương ứng tại bước create; không thêm auth/share/provider flow. | Không dựng claim/controls mẫu. Owner quyết định copy và chức năng sau tạo phòng ở task riêng. |
| Ba action xếp dọc | 5.9 | Task yêu cầu action buttons một hàng; giữ đủ save/discard/keep. | Dùng SheetActions ngang, equal widths; nhãn truy cập đủ. Nhãn hiển thị có thể ellipsize ở chiều rộng hẹp theo shared Button; owner cần duyệt ảnh/short copy trước acceptance. |
| Kích thước/radius/typography/spacing chưa có ảnh đối chiếu | Toàn nhóm | Chưa chạy được app trong Simulator; token/component tests không chứng minh hình học. | Còn mở: chụp các bước + hai sheet ở Light/Dark trên build chứa diff này, ghi kích thước thiết bị/build ID và sửa mọi lệch ngoài bảng. |

## Hành vi giữ nguyên và kiểm tra

Không sửa `src/app`, API client/OpenAPI, auth/session, `roomStore`, `savedRoomDraft`, `schedule.ts`, `schedule-day.ts`, `budget-tiers.ts`, duration/calendar rules hoặc submit handlers. Request mapping vẫn ở `toCreateRoomBody`: couple total, group theo budgetMode; không nhân/chia lại amount. Chọn ngày inline khi chưa có giờ ghi riêng `scheduleDay` qua `patchDraft` hiện hữu; khi đã có giờ vẫn gọi `finishDateSheet`/`applyStart`. Sheet vẫn chọn tạm và chỉ Xong mới áp dụng. Inline thay ngày làm start trở thành quá khứ vẫn chặn Continue.

State matrix:

| Surface | Default/success | Loading | Empty | Error/offline/permission |
| --- | --- | --- | --- | --- |
| Type/group/time | Chọn/radio, count limit, lịch/duration | Không có async riêng | Không bịa start/time | Past start chặn Continue; end midnight và resume dùng helpers cũ |
| Location | GPS/area/radius thật | LoadingIndicator khi hỏi GPS | Không có nhãn GPS thì câu fallback hiện hữu | Permission denied/unavailable; giữ fix cũ và manual area; sheet vùng dùng state handling chung |
| Budget | Tier và prefill theo scope thật | Prefill optional không chặn nhập | Không có usualBudget thì không hiện chip | Query profile lỗi không dựng prefill; vẫn chọn tier được |
| Mood | Checkbox từ API; checked state | Skeleton + footer inset | Explicit empty state; taxonomy vẫn optional như trước | ErrorState/refetch, OfflineState khi paused không cache, submit error và loading overlay cũ |
| Draft exit/resume | Save/discard/keep đúng step/owner | LoadingIndicator trong overlay; action disabled | Clean draft thoát thẳng Home | Alert lỗi/save sign-in và resume validation giữ nguyên |

Kết quả round 1 tại head `8f68365` (lịch sử; kết quả round 2 ghi bên dưới):

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test` | FAIL, exit 1: 143 files pass, 1 fail, 1 skipped; 1.733 tests pass, 3 fail, 39 skipped |
| `pnpm test:ui --runInBand` | PASS, exit 0: 231 suites, 3.337 tests, 11 snapshots |
| 7 suites tập trung + regression profile/accent | PASS, exit 0: 81 tests |
| `git diff --check` | PASS, exit 0 |

Ba lỗi unit cùng nằm trong file không thay đổi `src/shared/config/__tests__/distribute-wrapper.test.ts`: “refuses while the owner is alive”, “refuses recovery while a recorded build process group is still alive”, “keeps the lock and run files when a recorded build group is still alive after the child exits”. Kiểm tra `ps` bị sandbox từ chối; case đầu không có stdout để `.trim()`, hai case process group nhận exit 0 thay vì từ chối. Đã trích nguyên base bằng `git archive c48d501` vào `/tmp/gogo-594-baseline-c48d501`, chạy lại riêng suite trên source gốc: **cùng 3 lỗi / 23 pass**, exit 1. Không sửa script release hay làm yếu test để đạt xanh trong sandbox.

[Log kiểm tra rút gọn và baseline](issue-594-checks.txt). Trước khi giao đã kiểm tra diff các file store/schedule/budget tiers và test process-lock không đổi.

Regression toàn repo phát hiện profile-defaults cũng dùng `createBudget.tier.*`. Copy riêng của wizard đã tách sang `createBudget.range.*`; các key tier cũ giữ nguyên. Suite profile-defaults và accent-foreground đã PASS lại trong 81 tests tập trung và trong lượt UI toàn repo cuối.

Còn mở trước acceptance: chạy lại unit trong môi trường có quyền process inspection; chụp/so Light/Dark thực tế và xử lý các dòng lệch cần owner quyết định. Không có commit, push, issue mới hay thay đổi remote.

## Owner sim feedback 2026-11-11

Cơ sở: owner kiểm sim iOS Dark ngày 2026-11-11, quyết định có ngày tại `dev/policy/decisions-log.md:5`, ngoại lệ Stitch §0.3. Patch trên head `f640dd79` của PR #598, issue #594. Chỉ Sol sửa; không stage/commit/push. Các kết quả round 1/2 bên dưới là lịch sử, không áp cho patch mới.

| # | Thay đổi và file | Bằng chứng hành vi |
| --- | --- | --- |
| 1 | `create-type.view/style`: bỏ pill và key `createType.selected`; viền `accent.primary`, selected title `discoveryHeading` (bold), unselected `introHeading` (semibold), cùng cỡ chữ. | Giữ `accessibilityState.selected`. Chọn viền + title đậm để màu không là tín hiệu duy nhất; không cần check glyph. Test pill vắng, border, font, đổi radio; Light/Dark × vi/en. |
| 2 | `create-type.view/style`: dùng `KeyboardAvoidingView` iOS padding, `ScrollView` có ref/layout/content-size/scroll handlers và `useFieldVisibility` đang dùng ở auth. CTA `GlassBar` docked nằm ngoài viewport cuộn, trong KAV. | Test cấu hình tránh bàn phím, input trong scroll viewport, CTA có không gian riêng; giữ maxLength 80 và draft title. Chưa kiểm reachability native trên build chứa patch. |
| 3 | `create-location.view`, `use-current-location.ts`, `area-controller.ts`: đọc ngay scope/position app-wide từ startup; `useFocusEffect` gọi `refresh()` im lặng. | Refresh dùng `resolve(false)` → `native-location.readCurrentLocation(false)` → `fresh-position.readFreshPosition`; không gọi permission request. Giữ manual choice và chống GPS chậm ghi đè manual. Refresh denied/unavailable giữ fix đã chọn và hiện cảnh báo/fallback. Test startup prefill không tap, focus refresh, denied/unavailable, race/dedup. |
| 4 | `create-location.view`: thay SecondaryBtn khu vực bằng shared `SearchField` readonly kích hoạt `CurrentAreaSheet` dùng chung với Home. | Outer button có accessible label; field display không mở keyboard và không tạo accessibility target trùng. Sheet vẫn dùng `AdministrativePicker`/search thật, không free-text payload. |
| 5 | `date-time-sheet.view/style`: mặc định một tuần chứa ngày chọn; mở rộng tháng/thu gọn tuần; bỏ ba quick chip ngày. | Test collapse/expand, selection, past disabled, month navigation, ngày xa, save/resume; không đổi helpers lịch hay mapping schedule. |
| 6 | `date-time-sheet`, `create-time`, `time-picker-sheet.view/style`, shared `time-wheel.view/style`: “Giờ khác” cùng appearance raised với các chip giờ; wheel giờ/phút dùng ScrollView snap, 24h/60 phút, adjustable accessibility. End row dùng chung TimePickerSheet. | Không có picker thời gian trong `package.json`; không thêm dependency/native module. Inline mở bottom sheet; trong date sheet wheel thay body của chính modal để không chồng modal iOS. Huỷ trái/Xong phải qua SheetActions; chọn tạm, Xong mới ghi; past start/end trước start bị chặn như trước. |
| 7 | `create-budget.view/style`: bỏ scope chip trùng; bỏ key scope couple không còn dùng. | Subtitle theo couple/group/mode giữ nguyên, mọi tier amount vẫn có unit; budgetAmount/budgetMode và prefill mapping không đổi. Test couple/group total/per_person. |
| 8 | Shared `checkbox-row.view/style` được tách từ `contribution-choices`; hai call sites contribution + `create-mood` dùng cùng component. | Mood ≤3, setting ≤2, spending chọn/bỏ chọn một; giới hạn có feedback và vẫn bỏ chọn được. Taxonomy labels API vi/en, skeleton theo row; trạng thái async và submit giữ nguyên. |

Permission: không có điểm xin quyền tự động mới. Startup và focus chỉ đọc quyền/position đã được cấp qua location layer hiện hữu. Người chưa cấp quyền thấy manual fallback; chỉ thao tác explicit trên control vị trí hoặc sheet khu vực hiện hữu mới đi qua `request()` như trước. Không thêm endpoint; không đổi API client/OpenAPI, store/schema, submit handlers hay request mapping. Refresh GPS là ngoại lệ UI-only đã được owner chỉ định.

Các deviation về check glyph và layout end-time/sheet action đã được quyết định này giải quyết nên đã bỏ khỏi bảng lệch. Những dòng còn lại vẫn mở đúng phạm vi của chúng. Các test component không chứng minh pixel parity hoặc cảm giác cuộn native; cần owner kiểm lại Light/Dark trên build chứa patch.

### Kiểm tra patch owner feedback

| Check | Kết quả patch owner 2026-11-11 |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui create-date --runInBand` | PASS: 2 suites / 12 tests, gồm Light/Dark × vi/en |
| UI affected + place-import/contribution + shared chip/sheet/i18n | PASS, exit 0: 20 suites / 305 tests |
| `pnpm exec vitest run src/shared/location src/features/create-date/__tests__` | PASS, exit 0: 11 files / 64 tests |
| ESLint toàn bộ TS/TSX đã chạm | PASS, exit 0; sandbox cho phép |
| `git diff --check` | PASS, exit 0 |
| Regression trước/sau, cùng 12 case `#594 owner` | HEAD `f640dd79`: 12 FAIL / 4 skipped; patch: 12 PASS / 4 skipped |

FAIL-before chạy bằng cách giữ nguyên test mới, tạm dùng nội dung production từ `git show HEAD:<path>` rồi khôi phục toàn bộ patch trong `finally`; không checkout/stage/commit. Các lỗi baseline đúng cơ chế cũ: pill còn, thiếu KAV/SearchField/focus refresh, duplicate scope, chip thay checkbox, thiếu lịch tuần/wheel đồng bộ. Production payload/store/schema vẫn không đổi. Không chạy lại toàn unit repo hoặc `distribute-wrapper.test.ts` trong lượt này; lỗi sandbox lịch sử không được coi là kết quả patch.

Danh sách lệnh, suite và SHA-256 nguồn đã test tại [issue-594-owner-feedback-checks.txt](issue-594-owner-feedback-checks.txt). Không có thay đổi stage/commit.

## Round 2 — Astra F-01/F-02/F-03

Basis: `8f68365ab8b59183735430f581b631f8f2fcd1b5` + working-tree diff, 2026-11-10. Không commit/push. SHA-256 của `git diff -- src`: `7a7b0545768f4a75a3a96e984dcfe8a7c5ce65308c650cd92a86c3f140d6c2dd`.

| Finding | Sửa và bằng chứng |
| --- | --- |
| F-01 P2 | Ngày inline chưa có giờ ghi vào `scheduleDay` qua `patchDraft`, dùng nguyên store/schema/draft save/load/restore. Mở sheet lấy lại ngày đó; chọn trong sheet vẫn tạm cho tới Xong, Huỷ không ghi. Hai regression tại `create-time-day.spec.tsx:247` và `:265`: trên production `8f68365` đều FAIL (`selected` expected true, received false); sau sửa đều PASS, gồm save → unmount → reset → disk load → restore → render → mở sheet. Chưa chọn giờ vẫn chặn Continue. |
| F-02 P2 | Chip chỉ giữ action vi/en ngắn; amount + unit chuyển sang Text riêng, không giới hạn dòng/ellipsis, có thể wrap theo chiều rộng. Accessible label của action vẫn chứa cả amount và `/người`. Regression tại `prefill-budget.spec.tsx:53`: trên `8f68365` FAIL (`numberOfLines` expected 0, received 1); sau sửa PASS. Test scope/submit cũ chọn đúng tier button khi prefill và tier cùng hiển thị giá. Shared Chip không đổi. |
| F-03 P3 | Bỏ hai deviation Dark và 5.1 owner-decides; ghi quyết định owner 2026-11-10 tại phần nguồn và cột Dark: AppToken Light/Dark toàn app khi thiếu Stitch Dark; wizard một màn mỗi bước; single-form 5.1 không dựng thành màn. |

Lệnh tái hiện giống nhau trước/sau: `pnpm test:ui --runInBand src/features/__tests__/create-time-day.spec.tsx src/features/__tests__/prefill-budget.spec.tsx -t '#594 F-'`. Trước: **3 failed / 32 skipped**, exit 1; sau: **3 passed / 32 skipped**, exit 0. Lượt FAIL-before chỉ thêm các regression test trên production chưa sửa tại `8f68365`.

| Kiểm tra round 2 | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| Affected UI: create-time-day, prefill-budget, create-time, wizard-exit (`pnpm test:ui --runInBand` + 4 paths) | PASS, exit 0: 4 suites / 46 tests |
| Affected unit: saved-room-day, saved-room-draft, room-draft, create-date/__tests__ (`pnpm exec vitest run` + paths) | PASS, exit 0: 7 suites / 49 tests |
| `pnpm test` | FAIL, exit 1: 143 files pass, 1 fail, 1 skipped; 1.733 tests pass, 3 fail, 39 skipped. Đúng ba lỗi distribute-wrapper/process inspection sandbox đã biết; Claude chạy lại ngoài sandbox. |
| `pnpm test:ui --maxWorkers=2` | PASS, exit 0: 231 suites / 3.340 tests / 11 snapshots |
| `git diff --check` | PASS, exit 0 |

Lượt UI toàn repo đầu có 230 suites PASS và một test selector cũ FAIL vì hai Text giờ cùng chứa giá prefill/tier. Đã scope selector vào tier button, chạy lại 4 affected suites PASS và chạy lại toàn bộ UI trên bản cuối. Không thay amount/unit hoặc mapping để xử lý test.

[Log FAIL-before/PASS-after và checks round 2](issue-594-round-2-checks.txt). Acceptance ảnh Light/Dark vẫn chưa hoàn tất; các test này không chứng minh pixel parity.

| File round 2 | Dòng working tree |
| --- | --- |
| [date-time-sheet.view.tsx](../../src/features/create-date/date-time-sheet.view.tsx) | 25–34, 68–75 |
| [create-time.view.tsx](../../src/features/create-date/create-time.view.tsx) | 121 |
| [create-budget.view.tsx](../../src/features/create-date/create-budget.view.tsx) | 77–84 |
| [create-budget.style.tsx](../../src/features/create-date/create-budget.style.tsx) | 31–32 |
| [create-time-day.spec.tsx](../../src/features/__tests__/create-time-day.spec.tsx) | 19, 247–281 |
| [prefill-budget.spec.tsx](../../src/features/__tests__/prefill-budget.spec.tsx) | 50, 53–61, 66, 134–136 |
| [vi.ts](../../src/shared/i18n/vi.ts) / [en.ts](../../src/shared/i18n/en.ts) | 751 / 770 |
| [issue-594-group-05a.md](issue-594-group-05a.md) | 11–23, 29–33, 60, 72, 91–127 |
| [issue-594-round-2-checks.txt](issue-594-round-2-checks.txt) | 1–230: log round 2 |

## Files:lines đã thay đổi — round 1

Các khoảng dòng dưới đây thuộc snapshot round 1 tại `8f68365`, tính từ diff với base `c48d501`. Dòng working tree hiện tại của bản sửa round 2 ở bảng phía trên.

| File | Dòng thay đổi |
| --- | --- |
| [src/features/__tests__/create-mood-footer-inset.spec.tsx](../../src/features/__tests__/create-mood-footer-inset.spec.tsx) | 4, 48–72 |
| [src/features/__tests__/create-room-name.spec.tsx](../../src/features/__tests__/create-room-name.spec.tsx) | 7, 19–42 |
| [src/features/__tests__/create-time-day.spec.tsx](../../src/features/__tests__/create-time-day.spec.tsx) | 244–286 |
| [src/features/__tests__/prefill-budget.spec.tsx](../../src/features/__tests__/prefill-budget.spec.tsx) | 32, 34, 114–128 |
| [src/features/__tests__/wizard-exit.spec.tsx](../../src/features/__tests__/wizard-exit.spec.tsx) | 50–62 |
| [src/features/create-date/create-budget.style.tsx](../../src/features/create-date/create-budget.style.tsx) | 5–6, 8, 13–14, 18–19 |
| [src/features/create-date/create-budget.view.tsx](../../src/features/create-date/create-budget.view.tsx) | 24, 62, 69, 71, 77, 84, 95–97, 100, 113 |
| [src/features/create-date/create-location.style.tsx](../../src/features/create-date/create-location.style.tsx) | 2, 5–6 |
| [src/features/create-date/create-location.view.tsx](../../src/features/create-date/create-location.view.tsx) | 18, 122, 125, 141–142, 161–162, 171, 178, 198 |
| [src/features/create-date/create-mood.style.tsx](../../src/features/create-date/create-mood.style.tsx) | 6, 9 |
| [src/features/create-date/create-mood.view.tsx](../../src/features/create-date/create-mood.view.tsx) | 15, 47, 150, 154–156, 178–179, 182–183, 186, 189, 196, 202, 206–207, 223 |
| [src/features/create-date/create-time.style.tsx](../../src/features/create-date/create-time.style.tsx) | 6, 8, 15 |
| [src/features/create-date/create-time.view.tsx](../../src/features/create-date/create-time.view.tsx) | 108, 115, 118–124, 136, 154, 178, 191, 193, 201 |
| [src/features/create-date/create-type.style.tsx](../../src/features/create-date/create-type.style.tsx) | 6, 22–25, 27, 30–34 |
| [src/features/create-date/create-type.view.tsx](../../src/features/create-date/create-type.view.tsx) | 14, 16, 72, 75–77, 86, 91–93, 96–97, 102, 129 |
| [src/features/create-date/date-time-sheet.style.tsx](../../src/features/create-date/date-time-sheet.style.tsx) | 7 |
| [src/features/create-date/date-time-sheet.view.tsx](../../src/features/create-date/date-time-sheet.view.tsx) | 9, 25–26, 69–70, 73–79, 90, 96–98, 100, 103, 117, 132, 189, 206, 216–217, 222, 225, 230–231, 235–237, 243–246 |
| [src/features/create-date/group-setup.style.tsx](../../src/features/create-date/group-setup.style.tsx) | 6–10, 17 |
| [src/features/create-date/group-setup.view.tsx](../../src/features/create-date/group-setup.view.tsx) | 3, 10, 12, 20–26, 46, 48–51, 53–60, 65, 79, 89, 108, 125, 127 |
| [src/features/create-date/save-draft.view.tsx](../../src/features/create-date/save-draft.view.tsx) | 9–10, 12, 34 |
| [src/features/create-date/wizard-actions.view.tsx](../../src/features/create-date/wizard-actions.view.tsx) | 2, 9–11, 13, 16, 61–63 |
| [src/features/create-date/wizard-step.style.tsx](../../src/features/create-date/wizard-step.style.tsx) | 6–8 |
| [src/features/create-date/wizard-step.view.tsx](../../src/features/create-date/wizard-step.view.tsx) | 40, 45–48 |
| [src/shared/i18n/en.ts](../../src/shared/i18n/en.ts) | 686–687, 702, 704, 706–707, 719, 727–729, 757–758, 771, 773, 1943–1971 |
| [src/shared/i18n/vi.ts](../../src/shared/i18n/vi.ts) | 667–668, 683, 685, 687–688, 700, 708–710, 738–739, 752, 754, 1922–1950 |
| [src/features/create-date/wizard-exit-prompt.view.tsx](../../src/features/create-date/wizard-exit-prompt.view.tsx) | 1–29 (mới) |
| [src/features/create-date/wizard-exit-prompt.style.tsx](../../src/features/create-date/wizard-exit-prompt.style.tsx) | 1–8 (mới) |

## Astra F-04/F-05 — 2026-11-11

Basis: PR #598, branch `feature/GOGO-594-redesign-g05a-create`, production HEAD `54e4b5124f162a5abc6072eb5e19f9a59f91cbb1`. Worktree sạch trước khi thêm regression. Lượt FAIL-before chỉ thêm test, production vẫn nguyên HEAD; sau đó sửa đúng hai finding. Không stage/commit/push. Kết quả PASS dưới đây thuộc working-tree patch trên HEAD này.

| Finding | Thay đổi | FAIL trên `54e4b51` → PASS sau sửa |
| --- | --- | --- |
| F-04 P1 | `schedule.ts` tách `slotOnDateToIso`: đặt giờ trên đúng ngày local; `slotToIso` time-only vẫn giữ next-occurrence. `schedule-day.ts` dùng chuyển đổi chính xác khi có day key hợp lệ, chỉ đẩy **end** sang hôm sau nếu end ≤ start. Giữ validation UI hiện hữu. | Regression UI chọn 12/11 qua lịch → wheel `00:00` → preset 2h → Continue → `toCreateRoomBody`. Trước sửa, draft vẫn `scheduleDay=2026-11-12`, nhưng payload start/end là **13/11 00:00/02:00**; expected **12/11 00:00/02:00**. Sau sửa khớp đúng ngày. Case kiểm soát wheel `23:00` + preset 2h cho end **13/11 01:00** PASS cả trước/sau. Unit explicit midnight hôm nay/ngày mai và explicit past slot: 3 FAIL trước → PASS sau; UI vẫn chặn past slot. Unit end `00:00`/`01:00`/bằng start: 3 PASS cả trước/sau. |
| F-05 P2 | `date-time-sheet.view.tsx` dựng tuần thu gọn từ thứ Hai + 6 ngày liên tiếp, không dùng các ô null của `monthGrid`. Khi chuyển tháng bằng mũi tên vẫn chọn tuần đầu/current week như trước; expanded month giữ nguyên. `chooseDay` hiện hữu cập nhật header theo ngày chọn. | Regression expand → chọn **30/11/2026** → collapse: trước sửa thiếu `date-inline-day-2026-12-01` (1–6/12 trống). Sau sửa đủ **30/11–6/12**, chọn **1/12** ghi draft, selected và header **Tháng 12, 2026**, vẫn đủ cùng tuần. Regression current week ngày **1/12**: trước sửa thiếu **30/11**; sau sửa hiện và disabled, nhấn không đổi draft. |

Lệnh FAIL/PASS giống nhau, chạy local UTC+07:00:

| Lệnh regression | FAIL-before | PASS-after |
| --- | --- | --- |
| `pnpm test:ui create-date --runInBand -t '#594 F-'` | exit 1: **3 failed / 1 passed / 12 skipped**; F-04 payload lệch một ngày, hai F-05 thiếu ngày adjacent-month | exit 0: **4 passed / 12 skipped** |
| `pnpm exec vitest run src/features/create-date/__tests__/schedule-day.test.ts -t '#594 F-04'` | exit 1: **3 failed / 3 passed / 6 skipped**; explicit slots bị roll sang hôm sau | exit 0: **6 passed / 6 skipped** |

Ví dụ assertion F-04 trước sửa (UTC): expected start `2026-11-11T17:00:00.000Z`, received `2026-11-12T17:00:00.000Z`; expected end `2026-11-11T19:00:00.000Z`, received `2026-11-12T19:00:00.000Z`. Sau sửa payload đúng expected. Chọn end qua preset là đường crossing-midnight hiện được hỗ trợ; end wheel vẫn từ chối end ≤ start theo validation có sẵn.

| Check patch cuối | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui create-date --runInBand` | PASS, exit 0: **2 suites / 16 tests** |
| `pnpm exec vitest run src/features/create-date/__tests__` | PASS, exit 0: **4 files / 27 tests**, gồm schedule, schedule-day, calendar, resume-day |
| `pnpm test:ui --runInBand src/features/__tests__/create-time.spec.tsx src/features/__tests__/create-time-day.spec.tsx` | PASS, exit 0: **2 suites / 28 tests**, gồm legacy selection, past validation, staged sheet, save/resume |
| `pnpm exec eslint src/features/create-date/schedule.ts src/features/create-date/schedule-day.ts src/features/create-date/date-time-sheet.view.tsx src/features/create-date/__tests__/owner-feedback.spec.tsx src/features/create-date/__tests__/schedule-day.test.ts` | PASS, exit 0 |
| `git diff --check` | PASS, exit 0 |

Sandbox cho phép toàn bộ checks trên. Đây là regression component/payload và unit; chưa xác nhận lại trên simulator/native build. API contract/store schema/submit mapping không đổi.


## Owner sim feedback round 2

Ngày 2026-11-11. Owner recheck simulator vòng 2 trong `dev/policy/decisions-log.md` (workspace), thắng tham chiếu Stitch cho đúng năm thay đổi này. Baseline: `ea8bdad6` / PR #598, nhánh `feature/GOGO-594-redesign-g05a-create`. Kết quả sau sửa thuộc working-tree patch trên head đó; không stage/commit/push. Không chạm nhánh/worktree `feature/GOGO-647-preference-checkbox` / `mobile-647`.

| Item | Thay đổi và file | Regression |
| --- | --- | --- |
| 1. Thiết lập nhóm | `group-setup.view.tsx` / `.style.tsx`: bỏ toàn bộ bốn chip khoảng người và style không còn dùng; chỉ còn stepper, giữ clamp/disabled 3–12 và hai thẻ budget đọc `participantCount`. | `round-two.spec.tsx`, `create-room-name.spec.tsx`: không còn nhãn chip; min/max disabled; tăng số người đổi nội dung budget. |
| 2. Vị trí | Tách row pin + area label + chevron của Home thành `src/shared/ui/location-row.view.tsx` / `.style.tsx`; Home và `create-location.view.tsx` dùng cùng row. Wizard mở `DiscoveryLocationSheet` (cùng alias shared sheet với Home/Discovery), bỏ thẻ GPS + heading khu vực cố định + SearchField. Giữ nguyên focus refresh, startup/native-fix prefill, lựa chọn manual, lỗi denied/unavailable, radius và payload mapping. Dùng `administrativeAreaLabel` cho area, native label/generic fix khi chưa có tên area. | `create-location-gps-card.spec.tsx`: label điền sẵn không tap; row mở sheet thật với current-location và manual picker; manual giữ qua focus; chọn lại GPS; native fix trước lookup; generic label; denied/unavailable; giữ fix cũ khi refresh lỗi. `prefill-location`, `location-permission`, `location-module-missing` cập nhật entry point và giữ payload/fallback assertions. Home/Search suites vẫn chạy. |
| 3. Lịch | `date-time-sheet.view.tsx` / `.style.tsx`: icon-only double-chevron down/up; `material-icon.tsx` thêm hai glyph Material dùng chung. Giữ nhãn truy cập cũ vi/en và target minWidth/minHeight 44pt, expanded state; giữ tuần vắt tháng/ngày đã chọn. | `round-two.spec.tsx`: vi/en, không text link, đúng glyph theo state, target ≥44; `owner-feedback.spec.tsx` vẫn kiểm tuần/tháng và cross-month F-05. |
| 4. Giờ | `create-time.view.tsx`: Bắt đầu mở trực tiếp `TimePickerSheet` như Giờ khác trước đây; ngày từ lịch inline, giờ được stage trong wheel đến Xong; Huỷ giữ giờ cũ. `date-time-sheet.view.tsx` chỉ còn lịch inline, bỏ hàng chip giờ và modal date/time cũ không còn caller. Kết thúc vẫn dùng sheet cũ; validation, duration và payload path không đổi. | `round-two.spec.tsx`, `owner-feedback.spec.tsx`, `create-time.spec.tsx`, `create-time-day.spec.tsx`: không time chips/Giờ khác; row mở wheel; staging/cancel; ngày + giờ đúng payload (gồm 00:00 và crossing midnight F-04); past-start, end validation, duration và save/resume. |
| 5. Mood | `create-mood.view.tsx` / `.style.tsx`: mỗi section giữ state mở riêng, mặc định first 5, nút Ghost ở header bên phải Tất cả/Thu gọn; thêm copy vi/en tại `src/shared/i18n/{vi,en}.ts`. Khi thu gọn hiển thị first 5 **cộng các lựa chọn đã chọn ngoài first 5**: có thể hơn 5 hàng để mọi lựa chọn luôn thấy và bỏ được, không âm thầm mất lựa chọn. Giữ mood max 3, setting max 2, spending single-select. | `round-two.spec.tsx`: cap cả ba section, expand/collapse độc lập, vi/en, chọn overflow rồi collapse/deselect, restored overflow cho cả ba loại và max-3; test checkbox/limit vòng 1 giữ nguyên. |

`src/shared/ui/__tests__/fixtures/stitch-color-pins.json` chuyển binding màu của row Home vào component shared; `chip.spec.tsx` bỏ registry `date-time-sheet.timeRow` đã xoá. Không thêm màu/token, không thay API/store schema/submit mapping.

### FAIL-before / PASS-after

Hai file regression cuối cùng được copy vào bản `git archive ea8bdad6` riêng trong `/tmp` (chỉ symlink dependencies có sẵn), không checkout/reset/stash worktree đang sửa. Cùng lệnh:

`pnpm test:ui --runInBand src/features/create-date/__tests__/round-two.spec.tsx src/features/__tests__/create-location-gps-card.spec.tsx`

- **FAIL-before:** exit 1, 2 suites failed; **14 failed / 4 passed / 18 tests**. Production nguyên `ea8bdad6`. Bắt đúng chip khoảng còn hiện; text toggle lịch; time chips/Giờ khác còn hiện; 21 checkbox thay vì 15 (18 khi có restored overflow); thiếu shared location row. Bốn case location fallback/native-label độc lập vẫn pass.
- **PASS-after:** exit 0, **2 suites / 18 tests passed**, cùng hai file regression trên working-tree patch.
- Raw log local: `/tmp/594-round2-before-final.log`, `/tmp/594-round2-after-final.log`; isolated baseline path ghi tại `/tmp/594-round2-baseline-path.txt`.

### Checks

- `pnpm typecheck`: PASS, exit 0.
- `pnpm test:ui create-date home search --runInBand`: PASS, exit 0, **10 suites / 196 tests** trên patch cuối. Raw log: `/tmp/594-round2-requested-ui-final.log`.
- `pnpm test:ui --runInBand create-date home search create-time create-location location-permission location-module-missing prefill-location create-room-name chip.spec`: PASS, exit 0, **20 suites / 324 tests**, gồm `chip.spec.tsx`, các regression trước đó và năm case bổ sung (restored overflow, en calendar, expand từng section). Raw log: `/tmp/594-round2-ui-final.log`.
- `pnpm test src/shared/ui src/shared/i18n src/shared/location src/features/create-date/__tests__`: PASS, exit 0, **32 files / 417 tests**, gồm `color-roles.test.ts` và shared location/controller checks.
- Touched-file `pnpm exec eslint <changed/new .ts/.tsx files>`: PASS, exit 0, không warning.
- `git diff --check`: PASS.

Sandbox cho phép các checks trên. Chưa chạy lại simulator/native build; kết quả component/unit không xác nhận visual acceptance trên simulator. Không có phần implementation nào trong năm item bị bỏ lại.


## Astra F-06 — 2026-11-11

Basis: PR #598, HEAD `ad6f3316` (round-2 commit), worktree `mobile-594` sạch trước khi thêm regression. Chỉ sửa F-06 P2; không stage/commit/push.

Owner rule thay thế mô tả overflow ở mục Mood round 2 phía trên: **thu gọn tối đa 5 lựa chọn mỗi section**. `create-mood.view.tsx` đưa các lựa chọn đã chọn lên trước (giữ thứ tự taxonomy giữa chúng), điền các slot còn lại bằng lựa chọn chưa chọn theo thứ tự taxonomy, rồi giới hạn 5. Max mood 3 / setting 2 / spending 1 bảo đảm mọi lựa chọn đã chọn đều nằm trong 5 slot và vẫn bỏ chọn được. Expanded giữ nguyên thứ tự taxonomy đầy đủ.

`round-two.spec.tsx` đổi assertions cũ 16/18 hàng thành 15 cho ba section thu gọn; kiểm tra thứ tự selected-first và fill, restored selections, max-3. Thêm regression riêng cho từng section: mở 7 lựa chọn → chọn lựa chọn thứ 7 → Thu gọn → đúng 5 hàng/section, lựa chọn thứ 7 đứng đầu và checked → bỏ chọn vẫn còn đúng 5 hàng. Case nhiều lựa chọn kiểm tra draft `['g', 'a', 'b']` hiển thị `a, b, g, c, d`, không theo thứ tự thao tác chọn.

| Check | Kết quả |
| --- | --- |
| FAIL-before: `pnpm test:ui create-date --runInBand` | Production nguyên `ad6f3316`, chỉ cập nhật test: exit 1, **1 suite failed / 2 passed; 6 tests failed / 23 passed**. Hai locale và ba case lựa chọn thứ 7 nhận 16 thay vì 15 hàng; restored selections nhận 18 thay vì 15. |
| PASS-after: cùng lệnh, cùng regression | exit 0, **3 suites / 29 tests passed** trên working-tree patch. |
| `pnpm typecheck` | PASS, exit 0; sandbox cho phép. |
| `pnpm exec eslint src/features/create-date/create-mood.view.tsx src/features/create-date/__tests__/round-two.spec.tsx` | PASS, exit 0. |
| `git diff --check` | PASS, exit 0. |

Raw logs local: `/tmp/594-f06-before.log`, `/tmp/594-f06-after.log`, `/tmp/594-f06-typecheck.log`. Đây là component regression; chưa chạy simulator/native build. API/store/submit mapping không thay đổi.


## Astra F-07 — 2026-11-11

Basis: PR #598, HEAD `9271a15056fa171f843809e031730c9b2b2a3a97`, worktree `mobile-594` sạch trước khi thêm regression. DEV chốt chính xác quy tắc bên dưới; thay thế thứ tự selected-first của mục F-06, vẫn giữ cap 5 và mọi lựa chọn đã chọn có thể bỏ chọn. Không stage/commit/push.

`collapsedVisible(options, selected)` giữ `base = options.slice(0, 5)` theo thứ tự gốc. Lấy các lựa chọn đã chọn trong `options.slice(5)`; nếu không có thì trả nguyên base. Nếu có, loại đúng số lượng tương ứng từ **cuối danh sách base chưa chọn**, rồi ghép overflow theo thứ tự gốc. Base luôn đứng trước overflow nên kết quả đã đúng original index, không cần sort. Giới hạn chọn hiện có (mood 3 / setting 2 / spending 1) bảo đảm đủ slot thay thế. Expanded vẫn dùng nguyên options.

Regression trong `round-two.spec.tsx`:

- Bấm vị trí thứ hai hai lần khi thu gọn: `b` bật rồi tắt, thứ tự `a..e` không đổi; chạy với 3, 5 và 7 options để bao gồm section ≤5.
- Chọn `g` khi mở rồi thu gọn: `a,b,c,d,g`; bỏ `g` khi thu gọn trả về `a,b,c,d,e` (vi/en).
- Giữ toàn bộ case F-06 cho ba section, restored selections và max-3; chỉ sửa expectations selected-first sang taxonomy order.
- Restored `e,f,g` giữ `a,b,e,f,g`, bỏ `f` cho `a,b,c,e,g`, bỏ `g` trả `a..e`: chứng minh chỉ thay unselected tail, không loại base đã chọn, luôn đúng 5 hàng mỗi section.

| Check | Kết quả |
| --- | --- |
| FAIL-before: `pnpm test:ui create-date --runInBand` | Production nguyên `9271a15`, chỉ cập nhật test: exit 1, **1 suite failed / 2 passed; 10 tests failed / 23 passed**. Bấm `b` làm thứ tự thành `b,a,c,d,e`; overflow vẫn selected-first. |
| PASS-after: cùng lệnh, cùng regression | exit 0, **3 suites / 33 tests passed** trên working-tree patch. |
| `pnpm typecheck` | PASS, exit 0; sandbox cho phép. |
| `pnpm exec eslint src/features/create-date/create-mood.view.tsx src/features/create-date/__tests__/round-two.spec.tsx` | PASS, exit 0. |
| `git diff --check` | PASS, exit 0. |

Raw logs local: `/tmp/594-f07-before.log`, `/tmp/594-f07-after.log`, `/tmp/594-f07-typecheck.log`. Đây là component regression; chưa chạy simulator/native build. API/store/submit mapping không thay đổi.


## Owner sim feedback round 3

Ngày 2026-11-11. Basis: PR #598, branch `feature/GOGO-594-redesign-g05a-create`, HEAD `9fcc4e9a`. Owner quyết định tại workspace `dev/policy/decisions-log.md:5`: vị trí dùng ô lớn và chuyển lên bước 1; quyết định này thắng tham chiếu Stitch. Working-tree patch, không stage/commit/push; không chạm `mobile-647`.

### Layout và thay đổi

- Bước 1 giữ thứ tự **loại kèo → Tên kèo → Khu vực → khoảng cách (chỉ khi dùng GPS)**. Khu vực nằm sau tên để đọc các thông tin cơ bản liên tục, trước CTA; cùng ScrollView/KeyboardAvoidingView đang có, CTA docked ngoài viewport và cơ chế đẩy ô tên lên khi mở bàn phím được giữ.
- Thêm shared `src/shared/ui/location-field.view.tsx` + `.style.tsx`: full width, `minHeight: 48`, padding/radius/surface/border giống `create-type.style.tsx:nameInput`; icon pin/chevron 20pt; `body`, primary khi có giá trị, secondary placeholder “Chọn khu vực”; một dòng ellipsis; role button, label + accessibilityValue đầy đủ. Kiểm cả tám theme (Light/Dark, các accent). Không sửa `LocationRow` của Home/Discovery.
- `create-type.view.tsx` dùng `use-create-location.ts` + `create-location-fields.view.tsx`/`.style.tsx` để chứa shared DiscoveryLocationSheet, radius chips, denied/unavailable warning, home-area prefill chip và stale-dataset warning. Xóa stylesheet của màn location cũ, chuyển các style còn dùng sang section. `createType.area` có vi/en (“Khu vực”/“Area”).
- `wizard-step.view.tsx`: couple 4 bước (`type → time → budget → mood`), group 5 bước (`type → group-setup → time → budget → mood`). `group-setup.view.tsx` đi thẳng sang time; Back vẫn pop theo stack. `draftStepPath` tạo đúng stack mới khi resume.
- `create-location.view.tsx` chỉ còn `<Redirect href="/create/type" />`; giữ nguyên route re-export `src/app/create/location.tsx`. Grep không còn caller sản phẩm push `/create/location`; telemetry route inventory vẫn giữ path vì file redirect vẫn tồn tại.
- `savedRoomDraft.ts` vẫn đọc `location` trong schema để tương thích snapshot v1/v2, nhưng save/restore ánh xạ về `type`. Snapshot v1 có area provider cũ cũng quay về bước 1 để chọn lại, không dùng centre thay vị trí thiết bị.
- GPS prefetch từ app start và refresh khi focus giữ qua shared location hook hiện có, không cần tap. Manual choice (kể cả khôi phục draft khi app GPS đã sẵn sàng) không bị ghi đè; mở picker từ draft seed lại lựa chọn đó để Clear/Use current position vẫn hoạt động. Radius ghi vào draft ngay khi chọn, giữ 10km/“Bất kỳ đâu” qua save/back/resume. Continue kiểm dataset trên bước 1 cho cả couple/group. `roomStore.ts`/`toCreateRoomBody` không thay đổi; test kiểm canonical codes, mutual exclusion và GPS/radius payload.
- Các suite location cũ nay render `CreateTypeScreen`; cập nhật name/step assertions, header registry cho redirect, chip ownership/spacing registry cho section mới, color pins cho field và section.

### FAIL-before / PASS-after và checks

Production baseline lấy bằng `git archive 9fcc4e9` trong thư mục `/tmp` độc lập; chỉ copy final regression tests và symlink node_modules để chạy. Không checkout/reset/stash hay sửa worktree khác. Cùng file `round-three.spec.tsx`, cùng lệnh `pnpm test:ui --runInBand round-three`:

| Check | HEAD `9fcc4e9` | Working-tree patch |
| --- | --- | --- |
| Final wizard regressions (field + sheet, step-1 validation couple/group, GPS radius/payload, counts mọi bước, navigation, old route, DraftResume couple/group, unlimited restored radius) | **11 FAIL** | **11 PASS** |
| `pnpm test src/shared/store/__tests__/saved-room-draft.test.ts` | **6 FAIL / 9 PASS** (old paths/location-route resume) | **15 PASS**, thuộc shared-module gate bên dưới |

- `pnpm typecheck`: **PASS**, exit 0, source cuối.
- `pnpm test:ui create-date wizard draft home --runInBand`: **PASS**, 9 suites / 251 tests (trước khi bổ sung 3 regression cuối).
- Gate UI cuối, bao gồm nguyên tập yêu cầu và các shared/legacy checks liên quan: `pnpm test:ui create-date wizard draft home create-location prefill-location location-permission location-module-missing create-room-name location-field chip.spec app-color-roles i18n-keys --runInBand`: **PASS, 20 suites / 436 tests**. Bao gồm new field tám theme, location focus/prefetch/manual/permissions, home prefill, color roles, chip spacing và các regression round 1/2.
- `pnpm test src/shared/store src/shared/ui src/shared/i18n`: **PASS, 24 suites / 377 tests**; bao gồm color-roles, chip ownership, header ownership và saved-draft.
- `pnpm exec eslint --no-cache <all touched existing/new .ts/.tsx files>`: **PASS**, exit 0; sandbox cho chạy, không dùng cache.
- `git diff --check`: **PASS**. Index trống; không git add/commit/push.

Evidence commands, summary và SHA-256 các file source/test tại [issue-594-round-3-checks.txt](issue-594-round-3-checks.txt). Raw logs nằm ở `/tmp/594-round3-*.log`, baseline path tại `/tmp/594-round3-baseline-path.txt`.

Chưa chạy simulator/native build hoặc acceptance ảnh mới Light/Dark; Jest kiểm token/layout props/a11y và hành vi, không xác nhận pixel parity hay trải nghiệm bàn phím trên thiết bị. Không đổi API contract, payload mapping, native dependencies hay worktree nhánh stacked.


## Owner sim feedback round 4

Ngày 2026-11-11. Basis: PR #598, branch `feature/GOGO-594-redesign-g05a-create`, HEAD `1b36efb23235af0f23cd9182495a93973473120e`. Owner quyết định tại workspace `dev/policy/decisions-log.md:5-6` và yêu cầu round 4 trong phiên. Kết quả bên dưới thuộc working-tree patch trên HEAD đó; không stage/commit/push, không chạm `mobile-647`.

### A. Toggle Mood và lịch

- Tách calendar toggle inline thành shared `src/shared/ui/expand-toggle.view.tsx` + `.style.tsx`; Mood và `DateTimeSheet` đều dùng `ExpandToggle`. Giữ chính xác glyph Material `keyboardDoubleArrowDown` / `keyboardDoubleArrowUp`, màu `accent.primary`, target minWidth/minHeight 44pt, role button và `accessibilityState.expanded`.
- Mood dùng lại `createMood.showAll` / `createMood.showLess` làm accessibilityLabel (vi/en), không còn chữ trong nút. Header giữ title flex 1, toggle bên phải, alignItems center. Lịch giữ nguyên accessibilityLabel/testID và hành vi tuần/tháng.
- Không sửa `collapsedVisible`, giới hạn chọn hay state expand riêng từng section: cap 5 và quy tắc thứ tự F-07 giữ nguyên; các regression vòng 2/F-06/F-07 tiếp tục PASS.

### B1. Picker dùng vị trí bước 1 — có một trường hợp bị chặn bởi contract

- Mood tạo snapshot từ **draft**, qua `draftPickerScope` trong `src/shared/location/picker-scope.ts`, rồi mở `{ pathname: '/places/search', params: { picker: '1', pickerScope: JSON.stringify(scope) } }`.
- Administrative area gửi `datasetVersion`, `provinceCode`, optional `communeCode`; không gửi lat/lng dù draft còn GPS cũ. Snapshot có cả tên area để biểu diễn scope theo kiểu dùng chung.
- GPS gửi chính xác `originLat`/`originLng` của draft thành `lat`/`lng` cùng **radiusM đã chọn**. Không lấy global `useAppAreaStore`/`useDiscoveryScope` làm scope picker này.
- Search chỉ áp dụng snapshot khi `picker=1` và có `pickerScope`; Zod kiểm cấu trúc, canonical-code format, tọa độ và giới hạn radius theo contract. Explicit scope sai → disable các search/preview reads, không fallback sang global. Ordinary search, Saved suggestion scope và picker cũ không mang param vẫn giữ đường xử lý cũ.
- List, filter preview, zero-result nearby suggestions và map dùng cùng scope. Pan map trong explicit picker không đổi query thành viewport ngoài vị trí wizard. Normal map exploration không đổi. Không lọc kết quả ở client.
- **BLOCKED — GPS + “Bất kỳ đâu” (`radiusM=null`)**: `GET /places/search` (`openapi/gogo.v1.yaml:3750-3751,3770`; generated `schema.d.ts` cùng contract) mặc định radius **10km** khi không gửi và chỉ nhận integer **100–100000m** khi gửi. Thiếu contract tìm theo GPS mà **không giới hạn khoảng cách**; không có null/unlimited radius hay cách giữ GPS chỉ để xếp hạng. Không bỏ radius để giả unlimited, không clamp 100km, không fake bằng lọc client. Với trường hợp này, “Thêm địa điểm” hiển thị disabled và lý do vi/en, hướng dẫn chọn radius ở bước 1. Thiếu/sai scope cũng disabled với lý do. Area và GPS có radius hợp lệ đã hoàn tất; unlimited cần BE contract/semantics trước khi tiếp tục sub-case này.

### B2. Seed places

- Danh sách dọc dùng shared `PlaceCardSmall`, mỗi card có shared `IconBtn size="regular"` (48×48pt), icon X và accessibilityLabel `createMood.removePlace`. Nút bỏ nằm cạnh card, không dùng slot header 22pt của card, tránh đè nội dung.
- `SeedPlaceCard` đọc `usePlaceDetail(seed.placeId)` và `detailToPlaceCard`; facts nằm trong query cache, không copy server data vào Zustand/saved draft. Trong lúc chưa có detail hoặc detail không đọc được, card giữ id/name của draft, các facts chưa có được bỏ qua; rating Google có nguồn/count qua shared `RatingChips`, không bịa giá/unit/rating.
- Bỏ lavender seed pills; “Thêm địa điểm” giữ shared Chip style của wizard trong row riêng dưới danh sách. Remove vẫn cập nhật draft bằng `removeSeedPlace` hiện có. Không đổi store schema, seed API payload hay submit mapping.
- Color pins thêm binding `ExpandToggle` → `accent.primary`; chip-spacing registry bỏ `create-mood.seedRow` đã xoá. Không thêm màu/token hay dependency.

### FAIL-before / PASS-after

Final regression `src/features/create-date/__tests__/round-four.spec.tsx` chạy với production baseline nguyên `git archive 1b36efb2` trong `/tmp` riêng, chỉ copy test cuối và symlink node_modules. Không checkout/reset/stash worktree. Cùng file, cùng lệnh `pnpm test:ui --runInBand round-four`:

| Trường hợp | Baseline `1b36efb2` | Working-tree patch |
| --- | --- | --- |
| Icon-only Mood/calendar, a11y/state/44pt/header alignment (vi/en) | 2 FAIL: Mood vẫn hiện text | 2 PASS |
| Mở picker từ Mood, area/GPS radius, không đổi theo global area | 2 FAIL: route không mang snapshot | 2 PASS |
| Normal search bỏ qua picker-only params/draft | 1 PASS | 1 PASS |
| Invalid explicit scope không fallback global | 1 FAIL: vẫn search global | 1 PASS |
| Unlimited GPS không giả radius API | 1 FAIL: add vẫn enabled | 1 PASS |
| Shared small seed cards, sparse facts, remove 48pt | 1 FAIL: không có small cards | 1 PASS |
| Filter preview + map pan giữ scope area/GPS | 2 FAIL: preview dùng global scope | 2 PASS |
| **Tổng** | **9 FAIL / 1 PASS** | **10 PASS** |

Raw baseline log: `/tmp/594-round4-before-final.log`; isolated baseline path: `/tmp/594-round4-baseline-path.txt`. PASS của final regression nằm trong hai UI gates cuối bên dưới. Unit `picker-scope.test.ts` thêm 25 trường hợp: province/commune, mutual exclusion, exact supported radii, missing/out-of-range position, invalid/unlimited radius và malformed route.

### Checks cuối

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui create-date search place --runInBand` | PASS, 35 suites / 617 tests, 9 snapshots; gồm final round-four, lịch, F-07, ordinary search/Saved/legacy picker/map và place cards |
| `pnpm test src/shared/location src/shared/ui src/shared/i18n` | PASS, 29 files / 414 tests; gồm scope validation, color pins, chip ownership và i18n |
| `pnpm test:ui --runInBand round-four chip.spec app-color-roles i18n-keys` | PASS, 6 suites / 156 tests; shared chip spacing, actual accent bindings, i18n và final round-four |
| `pnpm exec eslint --no-cache <all touched/new .ts/.tsx files>` | PASS, exit 0, không warning; sandbox cho phép |
| `git diff --check` | PASS |

Raw logs: `/tmp/594-round4-ui-final.log`, `/tmp/594-round4-shared-final.log`, `/tmp/594-round4-shared-ui-final.log`, `/tmp/594-round4-typecheck-final.log`, `/tmp/594-round4-lint-final.log`.

Đây là component/unit và contract-source verification. Chưa chạy simulator/native build hoặc live API acceptance; không tuyên bố visual/pixel acceptance. B1 unlimited-GPS vẫn BLOCKED như mô tả trên; không thay BE contract trong patch này. Index trống, không git add/commit/push.


## Astra F-08 / F-09 — 2026-11-11

Basis: PR #598, HEAD `7d511125d72902a65b3a9bbb543975c6f754f06e`, branch `feature/GOGO-594-redesign-g05a-create`, worktree `mobile-594` sạch lúc bắt đầu. Chỉ sửa hai finding P2 trên working tree; không stage/commit/push.

### F-08 — scope picker chỉ nằm trong bộ nhớ

- `picker-scope.ts` giữ một snapshot đã kiểm schema/copy bằng Zod trong bộ nhớ module, gắn UUID ngẫu nhiên từ `expo-crypto.randomUUID()` hiện có. Mở picker mới thay snapshot cũ; không persist dữ liệu scope. Cả GPS và canonical area dùng cùng đường xử lý.
- Mood chỉ truyền `{ picker: '1', pickerScope: <opaque UUID> }` trong `router.push`. Tọa độ/radius/canonical area không nằm trong route param. Search đọc snapshot bằng ID, giữ nguyên GPS/radius hoặc canonical codes của wizard cho search, filter preview, nearby suggestions và map; không lấy global area thay thế.
- Search unmount (đóng picker) hoặc Mood unmount (rời bước cuối/kết thúc wizard) xóa snapshot bằng ID. ID lạ/đã xóa, kể cả URL cũ chứa JSON, không resolve: explicit picker dùng `unavailable`, tắt search/preview và hiện `ErrorState` hiện hữu; không fallback sang scope global và không có nút retry unscoped. Picker cũ không truyền scope và ordinary Search giữ hành vi hiện có.
- Regression assert trực tiếp toàn bộ `router.push` args chỉ có picker flag + UUID, không có tọa độ hay nội dung area; kiểm cleanup ở cả hai màn, mở lại ID đã xóa, ID không tồn tại, scope area/GPS độc lập global, preview/map vẫn giữ scope. Unit kiểm snapshot không đổi khi input bị sửa, ID mới khác ID cũ, clear ID cũ không xóa snapshot mới.

### F-09 — không gán trạng thái ít đánh giá khi chưa biết count

- Sửa tại shared `RatingChips` / `GoGoRatingBadge`: guard dữ liệu thiếu áp dụng cả compact. Nếu không có rating Google/GoGo và chưa biết `gogoRatingCount`, bỏ cả row; GoGo badge riêng cũng bỏ khi count chưa biết. Count có thật vẫn giữ nguyên wording/ngưỡng/điểm và Google badge.
- Seed id/name fallback được kiểm khi detail offline hoặc failed, cùng mixed full/sparse seed list; sparse card không còn Google/GoGo badge hay row rating rỗng. Các case count 0, 3, 4 vẫn hiện `GoGo · Chưa đủ đánh giá (n)` và không hiện score dưới ngưỡng.
- Cập nhật expectation cũ của nearby sparse card và hai snapshot minimal SMALL Light/Dark: chỉ bỏ rating row/badge chưa có dữ liệu; full-card snapshots và các case known count giữ nguyên.

### FAIL-before / PASS-after

Production baseline lấy từ `git archive 7d51112` vào `/tmp/594-f08-f09-baseline.q97WNr`, chỉ copy hai file test cuối (`round-four.spec.tsx`, `place-card.spec.tsx`) và symlink node_modules. Không checkout/reset/stash worktree. Cùng final tests, cùng lệnh:

`pnpm test:ui --runInBand round-four place-card.spec -t 'F-08|F-09|seed places use vertical'`

| Regression | Baseline `7d51112` | Working-tree patch |
| --- | --- | --- |
| F-08: router args chỉ có UUID, area/GPS | **2 FAIL**: nhận JSON scope, GPS có exact lat/lng | **2 PASS** |
| F-08: đóng picker/wizard xóa snapshot, ID cũ hiện error | **2 FAIL**: scope vẫn đọc được sau khi đóng | **2 PASS** |
| F-08: ID không tồn tại, search/preview disabled và error | **1 PASS** | **1 PASS** |
| F-09: sparse shared card, mixed seed list, offline/failed detail | **4 FAIL**: vẫn có GoGo badge dù thiếu count | **4 PASS** |
| F-09: known count 0/3/4 giữ wording dưới ngưỡng | **3 PASS** | **3 PASS** |
| **Tổng** | **8 FAIL / 4 PASS**, exit 1 | **12 PASS**, exit 0 |

Raw logs: `/tmp/594-f08-f09-before-final.log`, `/tmp/594-f08-f09-after-final.log`. Baseline path cũng ghi tại `/tmp/594-f08-f09-baseline-path.txt`.

### Checks cuối

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | **PASS**, exit 0 |
| `pnpm test:ui create-date search place-card --runInBand` | **PASS**, 13 suites / 343 tests / 9 snapshots |
| `pnpm test src/shared/location/picker-scope.test.ts` | **PASS**, 1 file / 26 tests |
| `pnpm exec eslint --no-cache <all touched .ts/.tsx files>` | **PASS**, exit 0, không warning; sandbox cho phép |
| `git diff --check` | **PASS** |

Lint bao gồm Mood, Search, `picker-scope.ts`/`.test.ts`, `rating-chips.view.tsx`, `round-four.spec.tsx`, `design-drift-home-search.spec.tsx`, `place-card.spec.tsx`, `place-card-layout.spec.tsx`.

Raw check logs: `/tmp/594-f08-f09-typecheck-final.log`, `/tmp/594-f08-f09-ui-final.log`, `/tmp/594-f08-f09-scope-unit.log`, `/tmp/594-f08-f09-lint-final.log`. UI gate còn cảnh báo Node `punycode` deprecated và thiếu i18next instance trong suite SearchField hiện hữu; không có test failure. Hai minimal snapshots đã được kiểm diff trước khi chạy lại gate cuối.

Source/test snapshot: **`rs-8c693093e4fc`**, scope `src`, manifest + binary diff ở `/tmp/594-f08-f09-snapshots/mobile-594-f08-f09-rs-8c693093e4fc/`; tài liệu verification này nằm ngoài scope snapshot để tránh tự tham chiếu. Source/test không đổi sau checks; verify manifest MATCH trước khi bàn giao.

Đây là component/unit regression, chưa chạy simulator/native build hoặc live API acceptance. F-08/F-09 đã sửa và có FAIL-before/PASS-after; không thay API contract hay hành vi unlimited-GPS đã ghi ở round 4. Index trống; không git add/commit/push.

## Astra F-10 — 2026-11-11

Basis: PR #598, HEAD `b3789a98`, worktree `mobile-594` sạch lúc bắt đầu. Áp dụng đúng DEV decision: chặn mở picker đồng thời tại CreateMood, giữ singleton scope store và cleanup hiện có.

- `pickerOpening` là ref đồng bộ: set `true` trước `savePickerScope` và `router.push`; các press tiếp theo bị bỏ qua. State `isPickerOpening` chỉ điều khiển disabled visual/a11y của shared Chip, không spinner.
- `useFocusEffect` với callback ổn định (`useCallback`, dependencies rỗng) reset ref và disabled state khi CreateMood nhận lại focus sau khi picker trả về. Render do draft thay đổi không reset guard.
- Regression trong `round-four.spec.tsx` kiểm cả canonical area và GPS: gọi cùng handler hai lần đồng bộ trước render → đúng một scope save/một push, ID đầu vẫn đọc được, Add disabled; render draft rồi press tiếp vẫn bị chặn; gọi focus callback → Add enabled và press mới save/push lần hai với ID mới hợp lệ. Chip thật vẫn render; wrapper test chỉ giữ handler để gọi đồng bộ. UUID mock riêng trả ID khác nhau, thay vì UUID hằng của global Jest setup.
- Bổ sung `useFocusEffect` vào router mock cũ của `round-two.spec.tsx` để các regression hiện có tiếp tục render CreateMood.

### FAIL-before / PASS-after

Baseline production lấy nguyên `git archive b3789a9` vào thư mục `/tmp` riêng, chỉ copy final `round-four.spec.tsx` và symlink node_modules; không checkout/reset/stash worktree. Đường dẫn baseline: `/tmp/594-f10-baseline-path.txt`. Cùng final tests và lệnh `pnpm test:ui --runInBand round-four -t F-10`:

| Regression | Baseline `b3789a9` | Working-tree patch |
| --- | --- | --- |
| Hai press đồng bộ, canonical area | **FAIL**: 2 saves / 2 pushes | **PASS**: 1 save / 1 push; focus trở lại cho phép mở tiếp |
| Hai press đồng bộ, GPS | **FAIL**: 2 saves / 2 pushes | **PASS**: 1 save / 1 push; focus trở lại cho phép mở tiếp |
| **Tổng** | **2 FAIL**, exit 1 | **2 PASS**, exit 0 |

Raw logs: `/tmp/594-f10-before-final.log`, `/tmp/594-f10-after-final.log`.

### Checks cuối

| Lệnh | Kết quả |
| --- | --- |
| `pnpm test:ui create-date --runInBand` | **PASS**, 5 suites / 63 tests |
| `pnpm typecheck` | **PASS**, exit 0; sandbox cho phép |
| `pnpm exec eslint --no-cache src/features/create-date/create-mood.view.tsx src/features/create-date/__tests__/round-four.spec.tsx src/features/create-date/__tests__/round-two.spec.tsx` | **PASS**, exit 0, không warning |
| `git diff --check` | **PASS** |

Raw check logs: `/tmp/594-f10-ui-final.log`, `/tmp/594-f10-typecheck-final.log`, `/tmp/594-f10-lint-final.log`. UI gate có cảnh báo Node `punycode` deprecated hiện hữu; không có test failure.

Đây là component regression; chưa chạy simulator/native build hoặc live API acceptance. Chỉ sửa F-10 tại CreateMood và test harness liên quan; singleton scope store/cleanup không đổi. Không git add/commit/push; index trống khi bàn giao.

## Astra F-11 — assistant community-rating regression — 2026-11-11

Basis: PR #598, HEAD `ed6c0ef75754428c6bf89eb4603f266882c9d1d1`, worktree `mobile-594` sạch trước điều tra. Owner yêu cầu điều tra rồi sửa regression do F-09 (`b3789a9`); kết quả sau sửa thuộc working-tree patch, không stage/commit.

Finding ID: **F-11** (regression phát sinh từ fix F-09); detected **`ed6c0ef`**, fixed **`ed91a7df373565f01f82ab18aa3671cd3e525d8e`**. Phần dưới giữ nguyên evidence FAIL `ed6c0ef` → PASS source/test được commit tại `ed91a7d`; đây là đối soát ID lịch sử, không phải lần chạy lại matrix trong vòng F-12. Mapper giữ cả `gogoRating` và `gogoRatingCount` ngoài availability spread, kể cả unavailable; không đổi F-09 sparse-rating guard.

### Điều tra payload, contract và mapper

- Generated `AssistantPlaceCard.facts` chỉ bắt buộc `name` (`src/shared/api/schema.d.ts:11500-11501`); `gogoRating?: number` và `gogoRatingCount?: number` là hai field optional (`:11518-11520`). Count có thể hiện diện với giá trị **0**, không có default 0 khi field vắng. Contract không cho count null; guard UI `== null` vẫn bỏ cả absent/null nếu gặp ở runtime. OpenAPI nguồn: `openapi/gogo.v1.yaml:21838`, `:21868-21871`; score chỉ có từ 5 reviews.
- Fixture unavailable trong `src/features/__tests__/assistant-redesign-matrix.spec.tsx:206` có **score 4.6, count 12**. Mapper trên HEAD gốc đặt cả hai trong spread `card.available ? {...} : {}` (`src/features/assistant/result-card.view.tsx`, trước sửa dòng 54-60), nên làm mất facts đã biết khi unavailable. Không phải shared card coi mọi trường hợp thiếu cached detail là sparse.
- Fixture minimal (`src/features/__tests__/assistant-redesign-matrix.spec.tsx:220`) chỉ có `facts: { name }`: count **thực sự absent**, không phải known 0. Vì vậy sửa expectation cũ từ badge không có count thành **không badge/không rating row**, theo core 14/15 và type optional ở trên. Không gán count 0 để giữ expectation cũ.
- Các fixture `hours` có known count 0 (`src/features/__tests__/assistant-redesign-matrix.spec.tsx:238`) đã PASS trên HEAD gốc. Shared `RatingChips` / `GoGoRatingBadge` (`src/shared/ui/rating-chips.view.tsx:17`, `:28`) đã kiểm count unknown đúng; `ratingParts` (`src/shared/api/view-models.ts:348`) giữ threshold 5. Không cần sửa guard F-09.

### Fix và regression coverage

- Chuyển mapping **cả score lẫn count cộng đồng** ra ngoài availability spread (`src/features/assistant/result-card.view.tsx:54-57`), giữ nguyên giá trị từ payload, không fallback/coerce. Unavailable fixture có score 4.6/count 12 hiện `★ 4,6 (12) GoGo`, thay expectation cũ sai `Chưa đủ đánh giá` khi mapper đã làm mất count.
- Thêm case assistant **known count 0, không score**, với cả available/unavailable, chạy ở orange/orangeDark (`src/features/__tests__/assistant-redesign-matrix.spec.tsx:231-235`): badge phải hiện `GoGo · Chưa đủ đánh giá (0)`, không Google badge.
- F-09 sparse seed id/name, offline/failed detail và mixed full/sparse list vẫn PASS (`src/features/create-date/__tests__/round-four.spec.tsx:219`, `:245`). Shared sparse test và known counts 0/3/4 vẫn PASS (`src/shared/ui/__tests__/place-card.spec.tsx:360`, `:368`). Không thay seed mapper hay shared rating guards.

### FAIL trên ed6c0ef / PASS sau sửa

| Test basis / lệnh | Kết quả |
| --- | --- |
| HEAD gốc, chưa sửa source/test: `pnpm test:ui src/features/__tests__/assistant-redesign-matrix.spec.tsx --runInBand` | **FAIL: 4 failed / 52 passed**. Unavailable và minimal đều thiếu `place-gogo-rating`, ở cả hai theme. |
| Final matrix tests trên production source còn nguyên `ed6c0ef`: cùng lệnh trên | **FAIL: 4 failed / 56 passed**. Unavailable score/count 12 và case mới unavailable count 0 đều không có badge, ở cả hai theme. Minimal expectation đã sửa đúng theo field absent. |
| Final source/test patch: `pnpm test:ui assistant place-card create-date --runInBand` | **PASS: 28 suites / 456 tests / 9 snapshots**. Matrix PASS toàn bộ 60 cases, gồm các case từng thất bại và known-count-0 mới; F-09 sparse/seed regressions vẫn PASS. |
| `pnpm typecheck` | **PASS**, exit 0; sandbox cho phép. |
| `pnpm exec eslint --no-cache src/features/assistant/result-card.view.tsx src/features/__tests__/assistant-redesign-matrix.spec.tsx` | **PASS**, exit 0. |
| `git diff --check` | **PASS**. |

Raw logs: `/tmp/mobile-594-assistant-before.log`, `/tmp/mobile-594-assistant-final-tests-before.log`, `/tmp/mobile-594-rating-ui-after.log`, `/tmp/mobile-594-rating-typecheck.log`, `/tmp/mobile-594-rating-lint.log`.

Source/test snapshot: **`rs-1fa5d003876b`**, scope `src`; manifest và retrievable binary diff tại `/tmp/mobile-594-rating-snapshots/mobile-594-assistant-ratings-rs-1fa5d003876b/`. Tài liệu verification này ngoài snapshot scope; source/test không đổi sau checks. Manifest verify **MATCH** trước bàn giao.

Đây là component regression verification; chưa chạy simulator/native build hoặc live API acceptance. Không thay OpenAPI/generated types. Không git add/commit/push; index trống khi bàn giao.

## Owner sim feedback round 5 — 2026-11-11

Basis: PR #598, HEAD `ed91a7df373565f01f82ab18aa3671cd3e525d8e`, worktree `mobile-594` sạch lúc bắt đầu. Áp dụng owner decision “Tạo kèo vòng 5 (#598)” trong workspace `dev/policy/decisions-log.md`. Chỉ sửa working tree này; không thao tác `mobile-647`, không git add/commit/push.

### Thay đổi

- Seed card dùng optional `onRemove` + `removeAccessibilityLabel` trên shared `PlaceCardSmall`; type bắt buộc nhãn khi có handler. Bỏ wrapper hàng ngang và sibling IconBtn, nên card là con trực tiếp của danh sách dọc, chiếm trọn chiều ngang.
- X nằm absolute trong surface của card, inset trên/phải 8pt, visual tròn 32×32pt, icon 18pt `text.primary`, nền `surface.high` theo Light/Dark. `hitSlop` mở vào trong 12pt bên trái/dưới, thành target 44×44pt không bị bounds card cắt. Text column chừa 52pt bên phải để cả tên và địa chỉ không đè lên nút/hit area.
- `CardShell` có internal `surfaceAction` slot ngay trong surface, bên ngoài open target. Remove không nằm trong Pressable mở card; test kiểm cây render lẫn cả hai chiều press. Caller không truyền remove giữ nguyên layout/name padding, header action và save action hiện có; không sửa các call site khác.
- Mỗi Mood section chỉ có title trong header; shared `ExpandToggle` nằm sau option list và căn giữa bằng cùng style với lịch. Giữ logic collapse tối đa 5, thứ tự taxonomy, selected overflow, expand/collapse và nhãn vi/en. Calendar vẫn có toggle cuối danh sách ngày.
- Thêm color pins cho binding thực của small-card view/style (`text.primary`, `surface.high` và các role sẵn có). Không chuyển chip row hay thay chip gap: checkbox list/card list không thuộc chip registry; registry hiện có giữ nguyên và đã chạy gate.

### FAIL trên ed91a7d / PASS sau sửa

Final tests: `src/features/create-date/__tests__/round-four.spec.tsx` và `src/shared/ui/__tests__/place-card-remove.spec.tsx`. Baseline production lấy nguyên `git archive ed91a7d` vào `/tmp` riêng; chỉ copy hai final test files và symlink node_modules. Không checkout/reset/stash worktree. Baseline path ghi tại `/tmp/594-round5-baseline-path.txt`.

Cùng lệnh trên baseline và patch: `pnpm test:ui --runInBand round-four place-card-remove -t 'round 5'`.

| Regression | Baseline `ed91a7d` | Working-tree patch |
| --- | --- | --- |
| Mood toggle sau option list, header chỉ title, căn giữa, icon/a11y vi/en; calendar placement | 2 FAIL | 2 PASS |
| Seed remove trong full-width card, remove đúng seed, không route/open | 1 FAIL: remove ngoài card | 1 PASS |
| Optional remove top-right, text clearance, 44pt hit area, Light/Dark roles, remove/open độc lập | 2 FAIL: chưa có optional remove | 2 PASS |
| Collapse giữ 5 options, stable order và selected overflow | 1 PASS | 1 PASS |
| Caller không có remove giữ body/name/header action | 1 PASS | 1 PASS |
| **Tổng** | **5 FAIL / 2 PASS**, exit 1 | **7 PASS**, exit 0 |

Raw logs: `/tmp/594-round5-before-final.log`, `/tmp/594-round5-after-final.log`.

### Checks cuối

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui create-date place-card assistant --runInBand` | PASS, 29 suites / 460 tests / 9 snapshots |
| `pnpm test src/shared/ui/__tests__/color-roles.test.ts src/shared/ui/__tests__/chip-ownership.test.ts` | PASS, 2 files / 11 tests; role bindings và chip registry |
| `pnpm test:ui --runInBand chip.spec app-color-roles` | PASS, 4 suites / 105 tests |
| `pnpm exec eslint --no-cache <all 8 touched/new .ts/.tsx files>` | PASS, exit 0, không warning; sandbox cho phép |
| `git diff --check` | PASS |

Raw check logs: `/tmp/594-round5-typecheck-final.log`, `/tmp/594-round5-ui-final.log`, `/tmp/594-round5-token-chip.log`, `/tmp/594-round5-shared-ui.log`, `/tmp/594-round5-lint-final.log`. UI gate còn cảnh báo Node `punycode` deprecated hiện hữu. Typecheck ban đầu bắt thiếu required metadata trong fixture mới; đã bổ sung đúng type và chạy lại typecheck/UI/lint thành công.

Đây là component/unit regression và source/style verification; chưa chạy simulator/native build hoặc live API acceptance, không suy ra visual/pixel acceptance. Index trống; không git add/commit/push.

## Owner sim feedback round 6

Ngày 2026-11-11. Owner feedback tại workspace `dev/policy/decisions-log.md:5`; PR #598, branch `feature/GOGO-594-redesign-g05a-create`, baseline `20fe8a80`. Đây là working-tree patch, không stage/commit/push; không chạm `mobile-647`.

### Thay đổi và phạm vi

- Lỗi lấy vị trí ở bước 1 (`denied` / `unavailable`) dùng shared `useDialog`: title + hướng dẫn bật dịch vụ vị trí và cấp quyền cho GoGo trong cài đặt thiết bị. Hai nút cùng hàng, secondary **Huỷ** bên trái, primary **Xác nhận** bên phải, bằng chiều rộng. Xác nhận gọi `Linking.openSettings()` — cùng API mở trang cài đặt app đang dùng ở `settings/location-permission.view.tsx` và `settings/permissions.view.tsx`; không thêm deep link riêng.
- Huỷ ở câu hỏi đầu mở câu hỏi “Chọn khu vực thủ công?”; Xác nhận mở lại `DiscoveryLocationSheet` với các trường hành chính có sẵn, chọn và áp dụng được vào draft; Huỷ ở câu hỏi sau đóng flow. Dismiss bằng backdrop/back/escape chỉ đóng câu hỏi hiện tại. Giữ title role header, modal accessibility, shared button targets và bản dịch vi/en.
- `useCreateLocation` chỉ hiện thông báo tự động sau kết quả refresh thực sự lỗi, tối đa một lần trong lần mount wizard bước 1. Các bước tiếp theo push lên stack nên quay lại bước 1 không reset cờ; wizard mới được thông báo lại. Cờ được đặt trước khi trình bày; lỗi từ thao tác chủ động cũng tiêu thụ thông báo auto đang chờ. Mỗi tap chủ động lấy vị trí vẫn được thông báo lỗi; kết quả refresh sau khi rời bước 1 không mở popup.
- Sheet chỉ thêm callback tùy chọn `onLocationFailure` / `onClosed`; **chỉ wizard truyền callback này**. Home/Discovery giữ hành vi cũ. Giữ inline warning denied/unavailable ở wizard và sheet làm đường lui không modal sau khi đóng thông báo hoặc khi auto notice đã dùng hết; người dùng vẫn bấm ô khu vực để chọn thủ công. Nếu mở cài đặt bị từ chối, hiện warning vi/en có `accessibilityLiveRegion="polite"` bằng key hiện có.
- Chuỗi modal chờ native dismissal: sheet → dialog qua `Sheet.onClosed`; dialog → dialog / manual sheet qua opt-in `useDialog({ waitForDismiss: true })`. Dialog được giữ mounted với `visible=false` đến `Modal.onDismiss` trên iOS; Android/web hoàn thành sau commit ẩn modal. Callers cũ của `useDialog` vẫn dùng layout stack và thời điểm resolve mặc định.
- Tất cả type / group-setup / time / budget / mood dùng `WizardScreen`: `WizardStep` là khối chrome `flexShrink: 0`, ngoài phần nội dung có `flex: 1`, `minHeight: 0`, `overflow: hidden`. Navigation (back/title/save/close/bell) và progress ở khối cố định; nội dung cuộn trong ScrollView riêng bên dưới. Header cũng giữ vị trí trong các nhánh pending/error/offline của Mood.
- Bước tên giữ `KeyboardAvoidingView` iOS `padding`, đặt trực tiếp dưới chrome để giữ tọa độ `layout.y` mà RN dùng so với vị trí bàn phím; không lồng avoiding view bên trong body làm mất offset header. Giữ nguyên `useFieldVisibility`, refs, scroll/layout/focus handlers, keyboard taps/dismiss và GlassBar placement/insets ở từng bước.
- Registry header chuyển năm callers từ `WizardStep` sang `WizardScreen`; color pins thêm binding warning cho lỗi mở cài đặt. Không di chuyển binding màu cũ, không thêm token/palette, không đổi chip registry, API contract hay payload.

### FAIL trước / PASS sau

Dùng **cùng file** `src/features/create-date/__tests__/round-six.spec.tsx` trên baseline `20fe8a8` xuất bằng `git archive` vào `/private/tmp/gogo-594-round6-baseline.mITuWd` (chỉ thêm test, dùng cùng dependencies), rồi chạy trên patch. Không checkout/ghi đè source working tree để đo baseline.

| Regression | `20fe8a8` | Patch |
| --- | --- | --- |
| Manual failure denied/unavailable, vi/en, secondary-left/primary-right, Xác nhận mở settings | 4 FAIL: thiếu dialog | 4 PASS |
| Huỷ → câu hỏi thủ công → Xác nhận chọn/applied area; Huỷ lần hai; tap chủ động lặp lại | 2 FAIL: thiếu recovery flow | 2 PASS |
| Auto denied/unavailable một lần qua refocus/rerender, wizard mới được báo lại | 2 FAIL: thiếu auto dialog | 2 PASS |
| Auto → settings; auto khi sheet đang mở; lỗi mở settings có fallback | 3 FAIL: thiếu recovery flow | 3 PASS |
| Chrome không co + body bị giới hạn trên cả năm bước, đầy đủ navigation/progress ngoài scroll, footer ngoài scroll; cấu hình/y-offset KAV bước tên | 5 FAIL: thiếu bounded shell | 5 PASS |
| Auto thành công không popup; late auto không popup; Home/Discovery giữ inline fallback | 3 PASS | 3 PASS |
| **Tổng** | **16 FAIL / 3 PASS**, exit 1 | **19 PASS**, trong UI gate dưới đây |

Baseline vốn đã đặt `WizardStep` ngoài ScrollView ở cả năm screen. FAIL layout ở đây chứng minh thiếu khối chrome/body bị ràng buộc rõ ràng; không tuyên bố đã tái hiện chuyển động header trên simulator bằng Jest. Tests xác nhận hierarchy/style/keyboard contract; chuyển động và kích thước thực tế vẫn cần owner recheck trên native build.

### Checks cuối

Code/test/registry basis: **`rs-10c70b1ba456`**, scope `src` (docs không nằm trong fingerprint), manifest và patch/files tại `/private/tmp/594-round6-snapshots/mobile-594-round6-rs-10c70b1ba456/MANIFEST.txt`. Không thay source sau khi tạo basis và chạy gate.

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm test:ui create-date location dialog create-mood-footer-inset create-room-name wizard-exit --runInBand` | PASS, 20 suites / 180 tests, bao gồm toàn bộ bộ lọc yêu cầu `create-date location dialog` và regression footer/name/exit |
| `pnpm test src/shared/ui/__tests__/app-header-ownership.test.ts src/shared/ui/__tests__/color-roles.test.ts src/shared/ui/__tests__/chip-ownership.test.ts src/shared/i18n` | PASS, 4 files / 83 tests |
| `pnpm exec eslint <all 16 touched/new .ts/.tsx files>` | PASS, exit 0, không warning; sandbox cho phép |
| `git diff --check` | PASS |

Logs local: `/tmp/594-round6-final-before.log`, `/tmp/594-round6-ui.log`, `/tmp/594-round6-registry.log`, `/tmp/594-round6-typecheck.log`, `/tmp/594-round6-lint.log`. Native presenter giả lập dismissal trễ để bắt modal overlap; các flow không bị từ chối trình bày modal. UI gate có Node `punycode` deprecation hiện hữu. Chưa chạy simulator/native build hoặc live acceptance; không suy ra pixel parity, trải nghiệm bàn phím hay quyền hệ điều hành thực tế từ component tests. Index trống; không git add/commit.


## Round 6 — Astra F-12 — deferred location recovery — 2026-11-11

Basis: PR #598, detected HEAD **`862ab9ae`**, worktree `mobile-594` sạch khi bắt đầu. Chỉ sửa F-12 và đối soát nhãn F-11 bên trên; không stage/commit. Phần này thay thế mô tả round 6 trước đó về việc tiêu thụ auto notice trước khi trình bày và tự đóng area sheet khi auto refresh lỗi.

### Fix

- `wizard-modal.ts` là signal Zustand nhỏ, mỗi presenter giữ một token từ lúc visible đến `onClosed` (native dismissal), hoặc cleanup khi unmount. Đăng ký `WizardExitPrompt`, overlay lưu nháp/thoát, area sheet của wizard và cả start/end time sheets. Shared Dialog chỉ thêm callback tùy chọn `onShown` chuyển tiếp native `Modal.onShow`; không đổi default flow. Không sửa shared Sheet hay Home/Discovery.
- Auto denied/unavailable giữ pending khi bất kỳ token nào còn mở; không đóng modal người dùng đang sửa. Sau native dismissal, chỉ mở recovery khi bước 1 vẫn focused. `autoFailureShown` chỉ đặt khi native `Modal.onShow` báo dialog đã xuất hiện; guard riêng ngăn refresh/manual tạo hai recovery flow đồng thời.
- Exit prompt giữ mounted qua dismissal bằng `useDialog({ waitForDismiss: true })`, rồi mới resolve action và mở overlay nếu cần. Save/discard xác nhận tăng `exitVersion` ngay trước dismissal; pending auto và late refresh thuộc wizard cũ bị bỏ, kể cả router chưa unmount. Lưu nháp thành công/đóng wizard sạch cũng hủy recovery. Blur/unmount bỏ pending. Wizard mới lấy version hiện hành nên vẫn được auto notice mới.
- Manual tap vẫn đóng area sheet, chờ `onClosed`, rồi chạy recovery hiện có; từng tap lỗi mới vẫn được báo. Nếu còn wizard presenter khác, manual cũng chờ signal trống để tránh cùng collision. Thêm kiểm tra exit-save thất bại: auto cũ đã hủy, nhưng manual failure sau đó vẫn mở recovery được.

### FAIL `862ab9a` → PASS patch

Final test file: `src/features/create-date/__tests__/round-six.spec.tsx`; native presenter giả lập từ round 6 từ chối modal thứ hai cho đến dismissal trễ 5ms. Kiểm cả dialog thật xuất hiện và danh sách refused rỗng, không chỉ kiểm popup vô hình.

Baseline lấy nguyên production `git archive 862ab9a` vào `/tmp` riêng, chỉ copy final test file và symlink dependencies; không checkout/reset/stash working tree. Baseline path: `/tmp/594-f12-baseline-path.txt`. Cùng final test/lệnh ở hai phía: `pnpm test:ui --runInBand round-six -t F-12`.

| Regression | `862ab9a` | Patch |
| --- | --- | --- |
| Refresh lỗi trong exit prompt; keep editing → dialog đúng một lần; discard/save → không dialog dù screen còn mounted/focused và refocus | 3 FAIL: attempted modal bị refused | 3 PASS |
| Auto lỗi trong area sheet → giữ sheet, chỉ recovery sau user dismiss và native close | 1 FAIL: auto đóng area sheet | 1 PASS |
| Auto lỗi trong time sheet / save-draft overlay; save lỗi → recovery sau close | 2 FAIL: attempted modal bị refused | 2 PASS |
| Pending rồi mất focus trước keep-editing dismissal → không dialog | 1 FAIL: attempted modal bị refused trước blur | 1 PASS |
| Exit-save lỗi hủy auto cũ, manual tap sau đó vẫn recovery | 1 FAIL: recovery không xuất hiện sau collision | 1 PASS |
| **Tổng** | **8 FAIL**, exit 1 | **8 PASS**, exit 0 |

Raw logs: `/tmp/594-f12-before-final.log`, `/tmp/594-f12-after-final.log`.

### Checks

Source/test basis: **`rs-6d1e83995c90`**, scope `src`; manifest + retrievable diff/files: `/tmp/594-f12-snapshots/mobile-594-f12-final-rs-6d1e83995c90/MANIFEST.txt`. Docs ngoài fingerprint; source/test không đổi sau basis.

| Lệnh | Kết quả |
| --- | --- |
| `pnpm test:ui create-date wizard-exit dialog --runInBand` | **PASS**, 9 suites / 102 tests (gồm 26 round-six cases) |
| `pnpm typecheck` | **PASS**, exit 0; sandbox cho phép |
| `pnpm exec eslint --no-cache <8 touched/new TS/TSX files>` | **PASS**, exit 0, không warning |
| `git diff --check` | **PASS** |
| `snapshot.sh verify <manifest>` | **MATCH** |

Logs: `/tmp/594-f12-ui-final.log`, `/tmp/594-f12-typecheck-final.log`, `/tmp/594-f12-lint-final.log`. UI gate có Node `punycode` deprecation hiện hữu. Đây là component regression; chưa chạy simulator/native build/live acceptance. Index trống, HEAD giữ `862ab9ae`; không git add/commit.

## Owner sim feedback round 7

Ngày 2026-11-11. Sol sửa trên working tree `mobile-594`, PR #598, HEAD **`dc52c94a`**. Basis: owner sim round 7 tại workspace `dev/policy/decisions-log.md:5` và yêu cầu giao việc vòng này. Không chạm `mobile-647`; không stage/commit.

### Thay đổi và layout

- Lỗi vị trí dùng shared `ResultSheet` **error**, giữ title/body vi/en hướng dẫn bật quyền vị trí trong Cài đặt máy. Primary **Xác nhận** mở app settings sau native dismissal; secondary **Huỷ** đóng error sheet rồi mở `ResultSheet` **info** từ `onClosed`.
- Info sheet chỉ có primary **Xác nhận**, mở lại manual area picker sau `onClosed`. Backdrop, Android back và accessibility escape cùng đi qua `onClose` với hành vi xác nhận. **Không cần thêm non-dismissable flag cho Sheet**: close có đường đi bắt buộc sang picker. Cả error/info đăng ký `useWizardModal` tại caller và giữ signal tới `onClosed`; giữ F-12 deferral, once-per-session auto, retry bằng tap và inline fallback khi không mở được settings. Mọi chuyển sheet và settings đều chờ native dismissal.
- Thêm `src/app/create/_layout.tsx`: render `WizardStep` đúng một lần ngoài nested `<Stack screenOptions={{ headerShown: false }}>`; suy step từ `useSegments`. Header/back/title/save/close/bell và progress không thuộc các screen con. Progress dùng Reanimated `withTiming`, tôn trọng reduced motion. Các bước chỉ render content qua `WizardScreen`; mỗi bước giữ GlassBar và scroll/field handlers riêng.
- Đo chiều cao chrome ở layout, truyền bằng context vào `keyboardVerticalOffset` của bước tên để giữ tính toán bàn phím khi content nằm trong nested stack. Test đo giả lập 160pt xác nhận offset cập nhật.
- Later-step Back gọi `router.back()`. First-step Back và Android hardware back dùng cùng save/discard/keep prompt với Close. Root create gesture và first-step gesture tắt để không bỏ qua exit prompt. `unstable_settings.initialRouteName = 'type'` cung cấp route đầu cho deep links vào bước sau; giữ `/create/location → /create/type` và logic dựng đường đi của draft resume. Save của header đọc step mới sau khi chuyển route.
- Registry header chuyển các bước thành content dưới layout và kiểm ownership mới. Không di chuyển style/token binding, không thêm màu; color pins và chip registry hiện hữu giữ nguyên và đã chạy gate. API/store schema/submit mapping không đổi.

### FAIL trước / PASS sau

Xuất production **`git archive dc52c94`** vào `/private/tmp/594-round7-dc52c94-9pbxgke7`; chỉ copy hai final test files `round-six.spec.tsx`, `round-seven.spec.tsx` và symlink dependencies. Hai file test giống byte-for-byte ở baseline/patch. Không checkout/reset/stash working tree. Cùng lệnh: `pnpm test:ui --runInBand round-six round-seven`.

| Nhóm bằng chứng | dc52c94 | Patch |
| --- | --- | --- |
| Error ResultSheet/settings vi/en × denied/unavailable; Huỷ → info single action → manual apply; backdrop/back = confirm, explicit retry | 7 FAIL | 7 PASS |
| Offset bàn phím khi header thuộc parent layout | 1 FAIL | 1 PASS |
| Header/actions giữ cùng instance qua cả hai đường đi; mỗi step chỉ có content/footer; nested back, first back/exit choices, hardware back, deep-link initial route config, Save dùng step mới | 14 FAIL | 14 PASS |
| F-12 deferral/cancellation, once-per-session, focus/session lifecycle, settings failure, Home/Discovery và bounded body/footer còn lại | 19 PASS | 19 PASS |
| **Tổng** | **22 FAIL / 19 PASS**, exit 1 | **41 PASS**, exit 0 |

Presenter giả lập từ chối modal thứ hai tới khi native dismissal trễ 5ms hoàn tất; các recovery/F-12 flow đều có danh sách refused rỗng. Assert signal ở cả error và info. Location redirect và legacy draft-resume path được giữ trong `round-three.spec.tsx`; store tests kiểm draft persistence/path.

### Checks và giới hạn

Source/test SHA-256 của tập touched/new `src` files, sắp xếp path, hash `path + NUL + bytes + NUL`: **`3f32669df09a8261131710fbfe8920d665fd18dca6b41f7f96ee0f8aba8ca797`**. Docs ngoài fingerprint.

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | **PASS**, exit 0 |
| `pnpm test:ui create-date draft location wizard-exit create-room-name result-sheet --runInBand` | **PASS**, 19 suites / 198 tests |
| `pnpm test` với app-header-ownership, color-roles, chip-ownership, saved-room-draft, room-draft | **PASS**, 5 files / 97 tests |
| `pnpm exec eslint <15 touched/new TS/TSX files>` | **PASS**, exit 0, không warning; sandbox cho phép |
| `git diff --check` | **PASS** |

Logs: `/tmp/594-round7-baseline.log`, `/tmp/594-round7-after.log`, `/tmp/594-round7-ui.log`, `/tmp/594-round7-registry.log`, `/tmp/594-round7-typecheck.log`, `/tmp/594-round7-lint.log`. Baseline path còn ở `/tmp/594-round7-baseline-path.txt`. UI gate có Node `punycode` deprecation hiện hữu.

Đây là component/config/store regression. Stack/route segments được giả lập trong component tests; chưa kiểm native navigation transitions, runtime deep-link history, OS settings/quyền vị trí, bàn phím thực tế hoặc ảnh Light/Dark trên simulator. Không suy ra native acceptance/pixel parity từ Jest. HEAD giữ `dc52c94a`, index trống.


## Owner sim feedback round 8 (drafts)

Ngày 2026-11-11. Sol sửa trên worktree `mobile-594`, PR #598, từ HEAD **`ad784a1b`** (round 7 đã commit). Basis: owner decision `dev/policy/decisions-log.md:5` và yêu cầu giao việc round 8. Không truy cập/chạm `mobile-647`; không git add/commit.

### Thay đổi và delete UX

- Bỏ block “Tiếp tục nháp / Xoá nháp” khỏi Home và phần đầu tab Kế hoạch. Xoá `draft-resume.view.tsx` / `.style.tsx`, cập nhật test cũ và mock tham chiếu component đã bỏ. Giữ nguyên `savedRoomDraft` schema, persistence, restore, session guards và APP-053 account scoping.
- Trong danh sách **Sắp tới**, bản nháp của tài khoản hiện tại đứng trước các phòng, dùng đúng shared `PlanCard` qua presenter `DraftPlanCard`. Lịch sử không hiện nháp; không có nháp hoặc khác tài khoản thì không có thẻ. Empty state không hiện khi chỉ có nháp; loading/error/offline của room query không che thẻ nháp local.
- Pill shared `Chip` variant `default` (neutral), i18n mới `draft.status`: **vi “Bản nháp” / en “Draft”**. Trạng thái luôn có chữ. Icon theo audience, title đã trim hoặc `plans.untitled` (“Kèo chưa đặt tên”), người/ngân sách/thời gian lấy từ snapshot. Không thêm placeholder cho budget/time thiếu; ngày/giờ đang điền dở vẫn hiển thị phần có thật. Ngân sách dùng `budgetFact` và `budgetModeFor`, giữ đúng đơn vị và tổng của wizard couple, không chia bình quân.
- Tap thẻ gọi lại restore + `dropStaleDay` + `draftStepPath`: quay về bước đã lưu và dựng đầy đủ history cho Back; giữ tương thích draft bước location cũ → type.
- **Delete UX:** thêm `PlanCard.trailingAction` tuỳ chọn, dùng shared `IconBtn` regular **48×48pt**, icon trash màu `text.secondary`, accessibility label **“Xoá nháp”**. Đây là sibling của vùng mở thẻ, không là nút lồng trong nút resume. Nhấn mở shared **ResultSheet warning**, mô tả không thể hoàn tác; Huỷ bên trái, Xoá nháp destructive bên phải. Huỷ/backdrop/back giữ snapshot; chỉ xác nhận mới xoá memory/disk. Confirmation giữ account lifetime và identity của snapshot lúc mở: không xoá snapshot thay thế hoặc của lifetime cũ. Storage error dùng thông báo i18n `draft.deleteFailed`.
- Color bindings của shared PlanCard và draft presenter thêm vào `stitch-color-pins.json`; thêm registry `plan-card-ownership.test.ts` để pin hai presenter cùng dùng PlanCard, neutral status, warning ResultSheet và Home không còn draft entry. Không thay giá trị token/màu. Test shared card kiểm action độc lập và metadata thiếu; test legacy resume được chuyển sang thẻ mới.

### FAIL trước / PASS sau

Xuất production **`git archive ad784a1b`** ra `/private/tmp/594-round8-ad784a1b-9canjsa5`, symlink dependencies; chỉ copy hai final test files `plans-draft.spec.tsx`, `home-location-scope.spec.tsx`. Hai test files baseline/patch giống byte-for-byte. Không checkout/reset/stash working tree. Cùng lệnh: `pnpm test:ui --runInBand plans-draft home-location-scope`.

| Nhóm bằng chứng | ad784a1b | Patch |
| --- | --- | --- |
| Home không còn nút nháp dù tài khoản có snapshot | 1 FAIL: còn “Tiếp tục nháp” | 1 PASS |
| Shared thẻ đầu danh sách, pill neutral, facts + resume history couple/group | 2 FAIL: thiếu draft PlanCard | 2 PASS |
| Chỉ có draft → không empty; title fallback, ẩn budget/time thiếu; chỉ Sắp tới | 1 FAIL: thiếu draft PlanCard | 1 PASS |
| Room query pending/error vẫn có local draft | 2 FAIL: thiếu draft PlanCard | 2 PASS |
| Delete icon ≥44pt, cancel giữ, confirm xoá memory/disk và hiện lại empty | 1 FAIL: còn nút cũ thay icon 48pt | 1 PASS |
| English Draft; budget per-person và lịch điền dở | 2 FAIL: thiếu draft PlanCard | 2 PASS |
| Confirmation cũ không xoá snapshot thay thế | 1 FAIL: thiếu warning ResultSheet | 1 PASS |
| No-draft / khác tài khoản / đổi tài khoản + 20 Home regressions còn lại | 23 PASS | 23 PASS |
| **Tổng** | **10 FAIL / 23 PASS**, exit 1 | **33 PASS**, exit 0 |

Raw logs: `/tmp/594-round8-before-final.log`, `/tmp/594-round8-after-final.log`. Baseline path ghi tại `/tmp/594-round8-baseline-path.txt`. Không tính lỗi hạ tầng/test harness là product FAIL.

### Checks và giới hạn

Source/test review basis **`rs-1324ec6885f1`**, scope `src`; manifest + retrievable tracked diff/untracked files: `/tmp/594-round8-snapshots/mobile-594-round8-rs-1324ec6885f1/MANIFEST.txt`. Docs ngoài fingerprint; source/test không đổi sau basis.

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | **PASS**, exit 0 |
| `pnpm test:ui plans home draft create-date plan-card confirm-dialogs list-first-load --runInBand` | **PASS**, 20 suites / 316 tests; gồm toàn bộ requested filter và các touched suites bổ sung |
| `pnpm test` với plan-card-ownership, color-roles, chip-ownership, app-header-ownership, saved-room-draft, room-draft | **PASS**, 6 files / 101 tests |
| `pnpm exec eslint --no-cache <19 touched/new TS/TSX files>` | **PASS**, exit 0, không warning; sandbox cho phép |
| `git diff --check` | **PASS** |
| `snapshot.sh verify <manifest>` | **MATCH** |

Logs: `/tmp/594-round8-ui-final.log`, `/tmp/594-round8-registry-final.log`, `/tmp/594-round8-typecheck-final.log`, `/tmp/594-round8-lint-final.log`. Jest còn Node `punycode` deprecation hiện hữu.

Đây là component/store/static-ownership regression; chưa chạy native build/simulator, chưa đo layout/VoiceOver trên máy hoặc Light/Dark pixel parity. Không suy ra runtime acceptance từ Jest. HEAD giữ **`ad784a1b`**, index trống.

## Astra @b493438 — F-13 / F-14 / F-15

Ngày 2026-11-11. Sol sửa đúng ba findings trên worktree `mobile-594`, PR #598, từ HEAD **`b4934387980357124e7498f0678ed3beff7a5146`**. Không git add/commit; HEAD và index giữ nguyên.

### Diff và cách dựng navigation

- **F-13:** `DraftPlanCard` restore snapshot + `dropStaleDay` như trước, nhưng chỉ push **một** `/create/type`, truyền `resumeStep` khi cần. Route type re-export `create-type-entry.view.tsx`. Entry chạy bên trong create Stack đã mount, kiểm param bằng `draftStepSchema`, rồi gọi **nested** `navigation.reset({ index, routes })` với `draftStepPath(step, audience)`. Root giữ đúng một route `create`; nested routes là toàn bộ bước tới bước đã lưu. Reset bỏ param khỏi route type mới nên Back về type không restore lại. Entry không mount form/location effects trong lúc restore bước sau. Giữ `unstable_settings.initialRouteName = 'type'`, legacy location → type và header ở parent layout. Cập nhật comment history và inventory headerless cho entry mới; không đổi submit/exit handlers.
- **F-14:** metadata thẻ lấy ngày/giờ từ `scheduleDay/startTime/endTime` khi có, kể cả input điền dở; chỉ fallback `startAt/endAt` khi không có input. Không trộn instant cũ vào lịch đang sửa. Test vi/en restore draft, gọi đúng day/time setters của form, lưu bằng `SaveDraftButton` compact của header trước Continue, xác nhận instant cũ vẫn tồn tại trong snapshot nhưng thẻ hiển thị ngày/giờ mới. Giữ test legacy chỉ có instants.
- **F-15:** create Stack nhận `screenLayout={screenTagLayout}` từ shared observability. Trong `sentry-usage.spec.ts`, chỉ thêm dòng inventory `src/app/create/_layout.tsx Stack`; logic audit và mọi assertion khác giữ nguyên.

### FAIL trên b493438 / PASS sau

Xuất production bằng `git archive b493438` vào **`/private/tmp/594-f13-f15-b493438-Tm3LbI`**, symlink dependencies; copy ba final test files `draft-navigation.spec.tsx`, `plans-draft.spec.tsx`, `sentry-usage.spec.ts` và kiểm `cmp` giống byte-for-byte. Không checkout/reset/stash working tree. Cùng lệnh baseline/patch: `pnpm test:ui --runInBand draft-navigation plans-draft sentry-usage`.

| Bằng chứng | b493438 | Patch |
| --- | --- | --- |
| F-13: 7 later-step couple/group root-state + nested-history cases, 2 submit cases, 2 Plans single-push assertions | **11 FAIL** | **11 PASS** |
| F-14: header-save lịch vừa sửa, vi/en | **2 FAIL**, thẻ còn ngày/giờ từ instant cũ | **2 PASS** |
| F-15: audit navigator trên app tree | **1 FAIL**, create Stack thiếu screenTagLayout | **1 PASS** |
| Các regression còn lại, gồm first/legacy step, save/discard/header-save exit, legacy schedule và Sentry boundary | **40 PASS** | **40 PASS** |
| **Tổng** | **14 FAIL / 40 PASS**, exit 1 | **54 PASS**, exit 0 |

`draft-navigation.spec.tsx` dùng **Expo Router và React Navigation thật** qua `renderRouter`, đọc `navigationRef.getRootState()` (bỏ lớp `__root` của test shell). Production create layout/entry/header, saved store và Mood submit đều chạy thật; form bodies không liên quan và remote API response là fixtures. Với mọi later step của couple/group: assert root `[(tabs), create]`, nested route names/index đúng path, nhấn Back lần lượt chỉ pop nested step, về type không restore lại. Baseline couple budget có 3 root create routes, group mood có 5. Submit baseline để lại create routes; sau sửa root là `[(tabs), room/[roomId]]`, Back về Plans. Save/discard/header-save đều về root `[(tabs)]`.

Logs: `/tmp/594-f13-f15-before-final.log`, `/tmp/594-f13-f15-after-final.log`. Baseline path: `/tmp/594-f13-f15-baseline-path.txt`.

### Checks và giới hạn

Source/test review basis **`rs-cf0f27623f70`**, scope `src`, 10 touched/new files. Manifest và retrievable diff/files: `/tmp/594-f13-f15-snapshots/mobile-594-f13-f15-rs-cf0f27623f70/MANIFEST.txt`. Docs ngoài fingerprint.

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | **PASS**, exit 0 |
| `pnpm test:ui create-date plans draft --runInBand` | **PASS**, 15 suites / 158 tests, exit 0 |
| `pnpm test:ui --runInBand draft-navigation plans-draft sentry-usage` | **PASS**, 3 suites / 54 tests, exit 0 |
| `pnpm test` (toàn bộ Vitest) | **FAIL do sandbox**, exit 1: 152 files PASS / 1 FAIL / 1 skipped; 1812 tests PASS / 3 FAIL / 39 skipped |
| `pnpm exec eslint --no-cache <10 touched/new TS/TSX files>` | **PASS**, exit 0, không warning; sandbox cho phép |
| `git diff --check` | **PASS** |
| `snapshot.sh verify <manifest>` | **MATCH** |

Ba Vitest failures đều ở `src/shared/config/__tests__/distribute-wrapper.test.ts`: `refuses while the owner is alive`; `refuses recovery while a recorded build process group is still alive`; `keeps the lock and run files when a recorded build group is still alive after the child exits`. Chạy riêng file này trên archive **b493438** tái hiện đúng **3 FAIL / 23 PASS**, exit 1. Probe `spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)])` trả **`EPERM`** trong sandbox; các test kiểm PID/process group không thể đọc process state. Không sửa hoặc bỏ qua các test/script này. Log baseline: `/tmp/594-f13-f15-distribute-baseline.log`.

`sentry-usage.spec.ts` thuộc Jest (`*.spec.ts`), không thuộc Vitest (`*.test.ts`); đã chạy riêng trong gate 54 tests ở trên. Logs còn lại: `/tmp/594-f13-f15-typecheck-final.log`, `/tmp/594-f13-f15-ui-final.log`, `/tmp/594-f13-f15-vitest-final.log`, `/tmp/594-f13-f15-lint-final.log`. Jest có Node `punycode` deprecation hiện hữu.

Đây là bằng chứng navigation-state integration + component/store/static audit; chưa chạy native simulator/build hoặc DEV acceptance. HEAD vẫn **`b4934387`**, không staged changes.


## Owner sim feedback round 9

Ngày 2026-11-11. Sol sửa trên worktree `mobile-594`, PR #598, HEAD **`ac9b77815c3a9bfcd18706b7af1d60cb2b343606`**. Không sửa `mobile-647`; không git add/commit.

- ResultSheet thông tin sau “Huỷ”: đổi `createLocation.manualTitle/manualBody` thành lời hướng dẫn bằng vi/en. Tiếng Việt: “Chọn khu vực thủ công” / “GoGo chưa lấy được vị trí của bạn. Hãy chọn tỉnh/thành phố và phường/xã cho kèo này.” Giữ một nút “Xác nhận”.
- Shared `CurrentAreaSheet` (alias `DiscoveryLocationSheet`) nhận prop `mode="manualOnly"`: ẩn nút dùng vị trí hiện tại và dòng lỗi denied/unavailable, giữ picker thủ công và hàng hành động. Mode lưu cục bộ trong hook wizard, chỉ đặt khi mở từ recovery; mỗi lần bấm ô Khu vực đặt lại `default`. Home/Discovery không truyền mode, giữ hành vi cũ. Giữ thứ tự chờ native dismissal giữa các sheet.
- Step 1 bỏ warning denied/unavailable dưới ô Khu vực; giữ cảnh báo `administrative.changed` và cảnh báo mở Settings thất bại.

### FAIL trên ac9b778 / PASS sau

Dùng `git archive ac9b778` tạo baseline ở đường dẫn trong `/tmp/594-round9-baseline-path.txt`, symlink dependencies, copy ba final test files `round-six.spec.tsx`, `create-location-gps-card.spec.tsx`, `discovery-location.spec.tsx`; đã kiểm nội dung giống byte-for-byte. Không checkout/reset/stash worktree.

Cùng lệnh: `pnpm test:ui --runInBand round-six create-location-gps-card discovery-location`.

| Bằng chứng | ac9b778 | Patch |
| --- | --- | --- |
| Copy hướng dẫn vi/en và recovery mở picker thủ công | 2 FAIL | 2 PASS |
| Đóng info bằng backdrop/back → picker manual-only; đóng rồi bấm ô Khu vực để thử GPS lại | 2 FAIL | 2 PASS |
| Step 1 không có warning denied/unavailable | 2 FAIL | 2 PASS |
| Prop manualOnly ẩn GPS + failure text, default khôi phục cả hai; vẫn chọn và áp dụng thủ công | 2 FAIL | 2 PASS |
| Regression còn lại, gồm Settings, auto-failure, dismissal, Home/Discovery fallback | 35 PASS | 35 PASS |
| **Tổng** | **8 FAIL / 35 PASS**, exit 1 | **43 PASS**, exit 0 |

Logs: `/tmp/594-round9-before-final.log`, `/tmp/594-round9-after-final.log`.

### Checks

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | **PASS**, exit 0 |
| `pnpm test:ui create-date location home search --runInBand` | **PASS**, 22 suites / 345 tests, exit 0 |
| `pnpm exec eslint --no-cache <8 touched TS/TSX files>` | **PASS**, exit 0, không warning; sandbox cho phép |
| `git diff --check` | **PASS** |

Logs: `/tmp/594-round9-typecheck-final.log`, `/tmp/594-round9-ui-final.log`, `/tmp/594-round9-lint-final.log`. Jest còn cảnh báo Node `punycode` deprecation hiện hữu.

Đây là bằng chứng component/store regression; chưa chạy native build/simulator hoặc DEV acceptance. HEAD giữ `ac9b7781`, index trống.


## Owner sim feedback round 10 — 2026-11-11

Basis: PR #598, production baseline **`12d19d01`**, clean `mobile-594` at start; owner decision confirmed in shared `dev/policy/decisions-log.md` (2026-11-11, Tạo kèo vòng 10). No staging/commit; mobile-647 untouched.

- Removed header Save/floppy and Close/X from the layout-owned `WizardStep` actions. Bell and Back remain. Later-step Back still pops the nested step; first-step Back and Android hardware Back still use the same exit confirmation (or leave immediately when untouched). Root/first-step swipe protection stays in place.
- Deleted the now-unused `SaveDraftButton` and `wizard-actions.style.tsx`; removed its submit-overlay registry entry. There are no remaining runtime imports/callers. The removed handlers had no analytics events. Existing unrelated account/draft translations remain unchanged; dedicated exit-action keys give **vi: Ở lại / Bỏ nháp / Lưu nháp**, **en: Stay / Discard / Save draft**, in secondary-neutral / danger / primary order, with one dominant primary.
- Kept the exit-save/discard overlay, `useWizardModal(leaving)`, native dismissal callbacks, recovery cancellation, error/sign-in handling and creation-pending guards. F-12 tests now enter through Back; confirmed exit-save still cancels old auto recovery even if persistence fails, while later manual recovery remains available. Updated resumed-draft navigation and F-14 schedule persistence tests to use Back → prompt → Save instead of removed header actions.
- `SheetActions` now respects an explicit child `wrapLabel` opt-in; its default remains single-line. The three wizard buttons opt in and use tokenized 4pt horizontal padding. At 320pt: panel insets 20×2, row gaps 8×2, equal buttons 88pt wide, label space **80pt**. CoreText measurement of bundled Inter-SemiBold at the existing 15pt button size: Ở lại 31.85pt; Bỏ nháp 59.14pt; Lưu nháp 67.47pt; Stay 32.31pt; Discard 55.48pt; Save draft 73.65pt. All fit on one line at the app's default text size.
- Buttons have no line-count cap and retain a 48pt minimum height. **F-17: requirement withdrawn by DEV (app-wide fixed font scale); labels verified to fit one line at default scale**. The accessibility-size wrapping clause came from the DEV brief, not the owner. Existing shared Text forces `allowFontScaling={false}`. The width evidence above is font measurement plus rendered prop/style checks; no new simulator pass or screenshot acceptance is claimed.
- Round 10 changed no colour bindings; the removed action stylesheet contained layout only. Submit-overlay registry updated; header/plan-card/chip ownership gates pass. The colour-pin mismatch in `create-location-fields.view.tsx` was introduced by round 9 commit `12d19d0`, which removed the yellow inline warning without removing its `status.warningText` fixture entry. Reproducing it on the round 10 baseline does not make it a pre-existing baseline defect.

### FAIL before / PASS after

Same final `round-ten.spec.tsx` against an isolated `git archive 12d19d0` under `/tmp` (dependencies symlinked; no checkout/reset/stash) and this working tree, using `pnpm test:ui --runInBand round-ten`:

| Source | Result |
| --- | --- |
| `12d19d01` production + final regression file | **FAIL: 6 failed / 9 passed** — header Save/Close presence, old vi labels/row truncation, old en labels |
| Working tree + same regression file | **PASS: 15 / 15** — no Save/Close, persistent bell, nested/first/hardware Back, all exit choices, vi/en labels and wrapping |

Baseline directory recorded at `/tmp/mobile-594-round10-baseline-path.txt`. Logs: `/tmp/mobile-594-round10-before-final.log`, `/tmp/mobile-594-round10-after.log`.

### Checks

| Command | Result |
| --- | --- |
| `pnpm typecheck` | **PASS** |
| `pnpm test:ui create-date draft wizard-exit sheet-actions --runInBand` | **PASS: 12 suites / 160 tests**; includes requested `create-date draft` scope, F-12, F-13, F-14 and shared row defaults/opt-in |
| Touched existing/new TS/TSX files via `pnpm exec eslint` | **PASS**, exit 0, no diagnostics |
| Focused Vitest: submit-overlay, design-drift, mode-aware, plan-card-ownership, app-header-ownership, redesign-contrast, color-roles | **6 files pass; color-roles: 1 failure / 7 pass** (170 passed total). Same failure on round 10 baseline `12d19d0`: obsolete location-fields pin introduced by that round 9 commit; corrected under F-16 below. |
| `pnpm exec vitest run src/shared/ui/__tests__/chip-ownership.test.ts` | **PASS** |
| `git diff --check` | **PASS** |

A preliminary `pnpm test -- <files>` expanded to the full Vitest suite because `--` prevented positional filtering; stopped that unintended broader run. It reported the same three sandbox-sensitive `distribute-wrapper` process-liveness failures documented in the earlier verification section. No full-suite PASS is claimed.

Check logs: `/tmp/mobile-594-round10-ui.log`, `/tmp/mobile-594-round10-typecheck.log`, `/tmp/mobile-594-round10-lint.log`, `/tmp/mobile-594-round10-registry-focused.log`, `/tmp/mobile-594-round10-pins-baseline.log`, `/tmp/mobile-594-round10-chip-registry.log`. `RTK.md` referenced by supplied AGENTS instructions was absent from this worktree and checked ancestors.

## Astra F-16 / F-17 follow-up — 2026-11-11

Basis: PR #598, clean worktree at **`800184a6`** before edits. F-16 removes only the first, obsolete `status.warningText` entry for `create-location-fields.view.tsx` from `stitch-color-pins.json`; the two remaining warning bindings stay pinned. `color-roles.test.ts` and its exact binding comparison are unchanged. `git show 12d19d0 -- src/features/create-date/create-location-fields.view.tsx` confirms round 9 removed the yellow inline warning that owned this entry; the round 10 attribution above is corrected.

F-17 is a DEV requirement disposition only, with no runtime or test changes. Short vi/en exit labels remain. No exit-prompt test claims accessibility-size scaling; the round 10 doc now records the withdrawn requirement and default-scale fit evidence.

| Command | Before: clean `800184a6` | After: working tree |
| --- | --- | --- |
| `pnpm exec vitest run src/shared/ui/__tests__/color-roles.test.ts` | **FAIL**, exit 1: 1 failed / 7 passed; expected obsolete leading `status.warningText`, actual bindings start with `text.secondary` | **PASS**, exit 0: 8 passed |
| `pnpm test:ui create-date --runInBand` | Not rerun before | **PASS**, exit 0: 9 suites / 134 tests |
| `git diff --check` | — | **PASS**, exit 0 |

Logs: `/tmp/594-f16-before-800184a.log`, `/tmp/594-f16-after.log`, `/tmp/594-f16-create-date.log`. Both requested test commands ran in the sandbox. No staging or commit; no native simulator or DEV acceptance claim.

## Owner decision — GPS + “Bất kỳ đâu” administrative-area picker (2026-11-11)

Basis: PR #598, `feature/GOGO-594-redesign-g05a-create`, baseline HEAD `547f6b8` in `mobile-594`. Owner decision in workspace `dev/policy/decisions-log.md`: GPS + unlimited searches within the administrative area resolved for that position. This supersedes the round-4 B1 unlimited-GPS BLOCKED status and its later references above; the search API contract is unchanged.

- Mood subscribes to the existing area controller used by step 1 / `administrativeAreaLabel`. When draft GPS has `radiusM=null`, it uses the resolved province/city + optional ward/commune only if the controller's ready GPS coordinates match the draft. Pending/failed resolution, a stale position, or an unrelated manual app area leaves Add disabled with the existing `seedScopeUnavailable` reason. The control reacts when resolution completes.
- The existing `draftPickerScope` validates an area snapshot, and the existing opaque `pickerScope` UUID store carries it to Search. URLs contain only `picker=1` and the UUID; no coordinates or area data. Search receives canonical dataset/province/commune codes without lat/lng/radius, and the snapshot survives a subsequent app-area change.
- GPS + finite radius still uses exact draft coordinates + radius even with a resolved area. Manual draft area keeps precedence. Room creation payload and search contract are unchanged. Removed unused `seedRadiusUnsupported` copy in vi/en.

### FAIL before / PASS after

New focused regressions were installed first, with production source still at `547f6b8`:

| Command / evidence | Baseline `547f6b8` | Working-tree patch |
| --- | --- | --- |
| `pnpm test:ui --runInBand src/features/create-date/__tests__/round-four.spec.tsx -t 'GPS anywhere\|GPS finite radius'` | **7 FAIL, 1 PASS**, 19 skipped | **8 PASS**, 19 skipped |

Baseline failures: two resolved-area cases and the pending-to-resolved transition remain disabled; four unavailable-area cases still show obsolete radius-specific copy instead of the retained scope-unavailable reason. Finite-radius preservation already passes. After the patch all eight pass, including area-scoped Search queries, UUID-only navigation, province-only resolution, and frozen picker scope. Existing manual-area tests also pass in the full UI gate.

Logs: `/tmp/594-gps-anywhere-before.log`, `/tmp/594-gps-anywhere-after.log`.

### Checks

- `pnpm typecheck` — **PASS** (`/tmp/594-gps-anywhere-typecheck.log`).
- `pnpm test:ui create-date search --runInBand` — **PASS**, 14 suites / 289 tests (`/tmp/594-gps-anywhere-ui.log`).
- `pnpm exec eslint src/features/create-date/create-mood.view.tsx src/features/create-date/__tests__/round-four.spec.tsx src/shared/i18n/vi.ts src/shared/i18n/en.ts` — **PASS**, no diagnostics (`/tmp/594-gps-anywhere-lint.log`).
- `git diff --check` — **PASS**.

Component regression evidence only; no simulator/native build or live API acceptance in this patch. No changes to `mobile-647`; no git add/commit/push. Index remains empty.
