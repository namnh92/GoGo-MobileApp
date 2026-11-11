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
