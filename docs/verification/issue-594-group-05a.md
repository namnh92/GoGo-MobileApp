# GoGo-MobileApp #594 — nhóm 05A Tạo kèo

Ngày: 2026-11-10 (Asia/Ho_Chi_Minh). Nhánh: `feature/GOGO-594-redesign-g05a-create`; base `c48d501`. UI-only; không commit/push.

**Trạng thái: đã sửa UI, chưa đạt acceptance “Khớp Stitch 100%”.** Đã đọc HTML và ảnh bằng Stitch MCP cho 9/9 màn. Chưa có ảnh app đối chiếu: `xcrun simctl list devices booted` thất bại vì CoreSimulatorService/notification subscription bị sandbox từ chối. Số màn so ảnh app cạnh Stitch ở cả hai theme: **0/9**. Không suy ra pixel parity từ component tests.

Issue đọc qua GitHub connector sau khi `gh issue view 594 --repo namnh92/GoGo-MobileApp` báo không kết nối được `api.github.com`.

## Nguồn và ghi chú từng màn

Project `17315762413421369447`. Round 1 đã gọi `get_screen` và `download_file` cho HTML và screenshot của từng ID dưới đây. `list_screens` chỉ có hai màn mang tên Dark (`Bảng màu`, `Bạn đang muốn gì hơn`), không có Dark cùng tên của nhóm 05A. **Owner 2026-11-10:** màn không có Stitch Dark dùng bộ AppToken Light/Dark toàn app; wizard giữ một màn riêng cho mỗi bước; 5.1 single-form **not built as a screen — owner 2026-11-10**, chỉ làm tham chiếu visual. Đây là quyết định đã chốt, không phải deviation cần duyệt lại. Không tạo/sửa màn trên Stitch. Không có cặp nguồn Light/Dark để chạy `parity.py`: **0/9 cặp nguồn đo được**, không báo PASS thay cho nguồn thiếu.

| Màn | Stitch ID | Light: phần đã áp dụng | Dark |
| --- | --- | --- | --- |
| 5.1 Tạo phòng hẹn | `11616575349645775674` | Chỉ tham chiếu visual cho bước hiện hữu; not built as a screen — owner 2026-11-10. | Không dựng màn riêng; phần tử dùng chung dùng AppToken Light/Dark toàn app (owner 2026-11-10); chưa so ảnh. |
| 5.2 Đối tượng | `12897203841795461814` | Tiêu đề, mô tả, hai thẻ icon + trạng thái chọn, input tên và counter, CTA dùng chung. Giữ maxLength 80. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng copy/layout; chưa so ảnh. |
| 5.3 Chế độ nhóm | `6534318264704160088` | Tiêu đề, mô tả, lưới bốn chip quy mô, bộ đếm chính xác, nội dung cuộn. Giữ 3–12 người và hai lựa chọn budgetMode hiện hữu. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng copy/layout; chưa so ảnh. |
| 5.4 Địa điểm | `10366405716754660736` | Tiêu đề, mô tả, thẻ GPS, chip bán kính dùng chung, chọn khu vực qua sheet hiện hữu, CTA. Giữ permission/fallback/prefill/version validation. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng trạng thái GPS/khu vực; chưa so ảnh. |
| 5.5 Thời gian | `14694142646341612511` | Lịch nội tuyến, shortcut ngày, đổi tháng, giờ bắt đầu và giờ khác dùng lại component của 5.6. Dòng tổng kết vẫn mở sheet chọn tạm; giữ giờ kết thúc và duration preset. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng lịch/ngày giờ được tính lúc chạy; chưa so ảnh. |
| 5.6 Chọn ngày giờ | `6910860286766835350` | Sheet hiện hữu có lịch, shortcut, giờ, summary. Huỷ trái/Xong phải dùng `SheetActions`; Huỷ giữ nguyên draft trước khi mở. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng validation/past-slot state; chưa so ảnh. |
| 5.7 Ngân sách | `9352497074123873706` | Thẻ tier, scope ngân sách chỉ đọc, số tiền VND đầy đủ, đơn vị trên từng mức và profile prefill, chọn có check. Không thay tier/default/amount. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng scope và đơn vị; chưa so ảnh. |
| 5.8 Mood & Tạo phòng | `7359368928226437041` | Tiêu đề, chip taxonomy theo API có highlight, seed chỉ hiện tên thật và nút bỏ, thêm địa điểm qua route cũ. Skeleton/error/offline/empty rõ ràng; CTA/loading dùng chung. | AppToken Light/Dark toàn app (owner 2026-11-10), cùng dữ liệu và trạng thái; chưa so ảnh. |
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
| Dòng end-time và các duration preset ngoài lịch | 5.5 | Chức năng hiện có bắt buộc giữ; ánh xạ được thời lượng trong 5.1. | Giữ end-time/preset cùng lịch; owner duyệt bố cục kết hợp khi có ảnh. |
| Nút Xong duy nhất | 5.6 | Task yêu cầu sheet một hàng Huỷ trái/primary phải. | Thêm Huỷ cùng hàng; X/gesture vẫn bỏ chọn tạm như trước. |
| Tab “Tính theo người” trong couple budget | 5.7 | Couple luôn TOTAL phòng; thêm tab sẽ đổi invariant/conversion. | Chỉ hiện scope của room thật. Per_person/total vẫn do bước group-setup chọn, không thêm toggle couple. |
| Tier mặc định/“Gợi ý nhiều nhất”, ảnh/copy menu thông minh | 5.7 | Default tier hiện là to800; tier label có thể trình bày lại nhưng không có nguồn chứng minh độ phổ biến hay gợi ý menu. | Giữ default/amount hiện hữu, không gắn badge/ảnh/claim mẫu. |
| Giá không kèm unit | 5.7, 5.8 | Vi phạm core.md 13, kể cả range ngân sách. | Mỗi tier có `/ cả phòng (2 người)`, `/người` hoặc `tổng nhóm` theo room; unknown price không hiện. |
| Mức chi “Đã khoá” thay cho taxonomy spending_style | 5.8 | Flow hiện có taxonomy spending_style độc lập với budget tier; thay field bằng locked amount sẽ bỏ hành vi hiện hữu. | Giữ taxonomy thật, không tạo fake locked-price row. Owner xác nhận mapping và task chức năng riêng nếu cần đổi. |
| Seed card ảnh/verified/rating/giá/địa chỉ Mơ Concept | 5.8 | Seed draft chỉ có id/name; không được bịa metadata hoặc đổi data model để lấp thiết kế. | Chỉ hiện tên thật + bỏ chọn. Follow-up: kiểm tra tái dùng PlaceSummary/detail hiện có trước khi đề xuất BE; nếu thiếu, BE proposal “Seed place summary có verified provenance, source/sample count rating, ảnh và price+unit nullable; dùng chung PlaceCard, omit unknown.” |
| Tối ưu vote bằng AI, “30 giây”, Zalo/Messenger | 5.8 | Không có chức năng/bảo đảm tương ứng tại bước create; không thêm auth/share/provider flow. | Không dựng claim/controls mẫu. Owner quyết định copy và chức năng sau tạo phòng ở task riêng. |
| Check glyph trên chip | Toàn nhóm | Shared Chip/task yêu cầu selected=highlight; semantic selected state + font weight đã có. | Giữ shared Chip, không thêm check thủ công lên chip. Radio card vẫn có chỉ báo chọn. |
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
| Mood | Chip từ API; selected state | Skeleton + footer inset | Explicit empty state; taxonomy vẫn optional như trước | ErrorState/refetch, OfflineState khi paused không cache, submit error và loading overlay cũ |
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
