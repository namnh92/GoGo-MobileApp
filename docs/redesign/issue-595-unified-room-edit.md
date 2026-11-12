# PR #600 / issue #595 — chỉnh sửa kèo và wizard, round 6e

Ngày: 2026-11-12. Branch `feature/GOGO-595-redesign-g05b-room`, HEAD
`cf2af48b`. Tiếp tục cây dirty round 6/6b/6c/6d; không commit, push hoặc stash.
Quyết định owner ngày 12/11 trong `GoGo/dev/policy/decisions-log.md:5–7`
thay thế phần Mood của round 6. Không sửa BE hay OpenAPI.

## Round 6g — prefill lịch và hoàn tất lưu

Theo brief owner 12/11, làm trên HEAD `c240e8ea`, giữ F-18/F-19; không commit,
stash hoặc push. Regression được viết trước. FAIL-before dùng bản sao riêng
trong `/private/tmp` với production sources từ `git show HEAD`, không đổi cây làm việc.

- Root cause tái hiện được: `RoomEditor` giữ `initial`/`base` từ cached room ở
  lần mount; response mới có lịch không cập nhật form dù chưa sửa gì. Nay chỉ
  hydrate khi pristine; dirty draft, mutation và 409 explicit rebase vẫn được giữ.
  Chưa có payload của đúng phòng trong screenshot để xác nhận cache là nguyên
  nhân duy nhất của lần owner thấy lỗi. Calendar không có effect xoá lịch quá khứ.
- Shared time body có `mode="edit"`: giữ ngày/giờ đã lưu theo timezone thiết bị,
  không báo lỗi creation-only cho lịch quá khứ hoặc lịch trống; lịch trống không
  tô chọn hôm nay hay tự điền ngày trên hàng Bắt đầu. Save vẫn disabled khi pristine.
- Edit truyền `showDurationPresets={false}`: bỏ list thời lượng và dòng “Dự kiến”.
  Không suy ra preset từ khoảng đã lưu; sửa giờ bắt đầu giữ nguyên kết thúc.
  Wizard giữ validation, preset và estimate cũ.
- Giữ `BlockingLoadingOverlay` chung từ request đầu đến cuối, sau khi stale sheet
  đóng theo F-18. Thành công toàn bộ đợi overlay native đóng, tắt removal guard rồi
  `router.back()` đúng một lần; không có back stack thì replace manage route.
  Lỗi/partial failure ở lại, giữ lỗi và chỉ retry phần còn thiếu; 409 không đổi.
- Bỏ unused import và dùng guard assertion trong F-18 test; lint về baseline.

Local verification: **6 Jest suites / 168 tests**, **3 Vitest files / 62 tests**,
`pnpm typecheck`, `pnpm lint` (0 errors / 4 baseline warnings), `git diff --check`
đều PASS. FAIL-before: **11 failed / 49 passed**, gồm hydration, empty/past validation,
duration và navigation; F-18/F-19 và wizard PASS trên HEAD gốc.

Evidence (mỗi log có lệnh ở đầu):
`dev/test-evidence/mobile-600-638-2026-11-11/r6g/fail-before.txt` và `pass-after.txt`
ở workspace GoGo. Chưa chạy simulator, live BFF, CI hoặc DEV acceptance.

## Màn chỉnh sửa kèo

Route `src/app/room/[roomId]/edit.tsx` là thin re-export của
`room-edit.view.tsx`. Giữ màn full screen của round 6, header bình thường,
nội dung scroll và một GlassBar cố định với “Lưu thay đổi”. Member/guest mở
route trực tiếp thấy permission state. Không mount form/tải sở thích.

Thứ tự section: **Tên → Khu vực → Số người (nhóm) → Ngân sách → Ngày giờ**.
Không còn Mood, `use-room-edit-preferences.ts`, preference GET/PUT, taxonomy
query, preference 409/rebase hay i18n/tests chỉ phục vụ Mood trong editor.

Các body dùng chung với wizard:

| Body | Hành vi giữ lại |
| --- | --- |
| `create-location-fields.view/style.tsx` | LocationField, chọn tỉnh/xã, GPS/radius, recovery ResultSheet; edit có adapter `use-room-edit-location.ts`, không ghi vào create draft. |
| `create-budget-fields.view/style.tsx` | BudgetPicker thật với thẻ lựa chọn cũ + nhập số tiền khác; editor dùng cùng list trong budget sheet, ngoài sheet chỉ hiện thẻ đang chọn. |
| `create-time-fields.view/style.tsx` | Calendar, DateTimeSheet, time wheels, duration presets; edit có adapter `room-edit-time.view/style.tsx`. |

Timestamp cũ được giữ bằng omission, kể cả seconds/milliseconds; custom
multi-day schedule không bị tự ép thành preset. Edit không tự refresh GPS hay
profile để thay vị trí đã lưu. Manual area xoá origin/radius atomically, GPS
thay administrativeArea; radius đơn lẻ giữ origin không được API công bố.

Save: **title endpoint → constraints PATCH**. Mỗi phần chỉ chạy khi đổi, phần
thành công cập nhật baseline/version; retry không rename lại title đã lưu.
PATCH vẫn chứa required budget pair + expectedConstraintVersion, optional
fields chỉ gửi khi đổi. Giữ stale-conditions ResultSheet và 409 explicit
reload/rebase. Back/header/gesture/accessibility escape dùng discard sheet
khi dirty; pending chặn rời màn hình và submit lặp.

## Round 6e — ngân sách quay lại thẻ lựa chọn

Theo owner 12/11 (`GoGo/dev/policy/decisions-log.md`, quyết định “Ngân sách:
quay lại thẻ lựa chọn cũ”), khôi phục UI từ
`825f5224:src/features/create-date/create-budget.view.tsx` và style tương ứng:
thẻ toàn chiều rộng, cao tối thiểu 88pt, padding 16pt, title đậm, mô tả phụ,
nút tròn 24pt bên phải. Thẻ chọn có accent tint + check; `radio` role,
`accessibilityState.selected` và `checked`, không chỉ đổi màu.

`BudgetPicker` là **một list dùng chung** cho wizard và edit sheet. Năm thẻ
tier (gồm “Không quan trọng”, giữ ceiling 5.000.000đ) có nguyên mô tả i18n cũ;
thẻ cuối “Nhập số tiền khác” / “Tự đặt mức chi tối đa” mở input ngay bên dưới.
Giữ nguyên title/subtitle wizard, pure logic `budget-picker.ts`, giới hạn
10.000–100.000.000đ, digits-only khi focus, paste grouping hợp lệ, giữ paste
sai + error, format khi blur, live preview có audience unit, F-16/F-17.

Editor dùng `RoomBudgetField`: chỉ một thẻ có title + description + chevron,
button role, label + hint, toàn thẻ là touch target. Custom hiển thị đúng số
tiền (`650.000đ / cả phòng (2 người)`); server amount 0 hiển thị “Chưa đặt
ngân sách”. Tap mở shared `Sheet` tên “Ngân sách”, có full list và group
budget-mode selector. Amount **và mode** được stage cục bộ. Huỷ, backdrop,
Android back, accessibility escape và swipe-down bỏ pending choice; mở lại lấy
giá trị form. “Xác nhận” ghi vào form, chưa gọi API; chỉ “Lưu thay đổi” chạy
stale confirmation và PATCH. Chọn lại đúng amount/mode không làm dirty.
Confirm bị disable khi custom sai; amount cũ ngoài bounds vẫn được giữ nguyên
để không phá F-13. Không đổi changed-field diff, stale flow hay required
budget pair/version trên PATCH.

Nếu custom amount trùng đúng ceiling của tier, vẫn giữ thẻ custom + ô nhập
khi mở lại sheet trong editor. Đây chỉ là selection UI cục bộ; form/PATCH
vẫn chỉ chứa numeric amount/mode. Nhập lại số tiền cũ không làm dirty.

Sheet có KAV dùng chung, viewport + ScrollView riêng qua `useFieldVisibility`,
focus input khi chọn custom, đo cả label/input/preview/error và cuộn lên trên
keyboard (kể cả lần focus sau khi keyboard đang mở). Actions dùng
`SheetActions`, cùng hàng, Huỷ trái / Xác nhận phải, bên ngoài scroll body.
Tests kiểm cả equal-width actions và cancel invalid custom rồi mở lại: input
và lỗi cũ bị bỏ, lựa chọn của form không đổi, không gọi API.

| Mục chụp/kiểm | testID |
| --- | --- |
| Wizard scroll | `create-budget-scroll` |
| Thẻ tier (wizard và sheet) | `budget-option-under300`, `budget-option-to500`, `budget-option-to800`, `budget-option-to1500`, `budget-option-flexible` |
| Thẻ custom | `budget-option-custom` |
| Radio/check trong từng thẻ | `<testID-thẻ>-radio` |
| Nhóm custom và một ô nhập | `budget-custom-field`, `budget-input-box` |
| Thẻ được chọn ở editor | `room-edit-budget-card` |
| Sheet / native modal | `room-budget-sheet`, `room-budget-sheet-modal` |
| Sheet viewport / scroll | `room-budget-sheet-viewport`, `room-budget-sheet-scroll` |
| Hàng actions | `room-budget-sheet-actions` (chứa shared `sheet-actions`) |
| Huỷ / Xác nhận | `room-budget-sheet-cancel`, `room-budget-sheet-confirm` (wrapper của từng button) |

File round 6e: `create-date/budget-picker.view/style.tsx`,
`create-date/budget-option-card.view/style.tsx`,
`create-date/create-budget.view/style.tsx`,
`create-date/create-budget-fields.view/style.tsx`,
`gogo-room/room-budget-field.view/style.tsx`, `gogo-room/room-editor.view/style.tsx`,
i18n vi/en; specs budget-picker, owner-feedback, prefill-budget,
room-edit-screen và room-edit-regressions; fixture Stitch colour bindings và
tài liệu này. Đã bỏ nhánh sectionTitle/style heading và style chip editor
không còn consumer; style thẻ chỉ nằm ở budget-option-card.style.tsx.
AST audit toàn bộ message dictionaries không có key trùng; **36 budget keys**
xuất hiện đúng một lần ở mỗi locale. Các thay đổi dirty
round 6/6b/6c/6d giữ nguyên; không commit, push hoặc stash.

Kiểm chứng round 6e (cây dirty trên `cf2af48b`):

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, 0 errors; 4 warning require-import có sẵn ở hai
  assistant specs không đổi.
- Jest: **22 suites / 499 tests PASS**, gồm toàn bộ create-date specs, room
  edit-screen/regressions, room-manage-feedback, room-state-matrix, prefill,
  confirm dialogs, guest join/replacement, wizard exit và session purge.
- Vitest: **11 files / 191 tests PASS**, gồm budget-picker pure logic,
  room-editor/schedule, post-auth route, room draft/saved draft, header và
  submit-overlay invariants, budget-unit, native intent và colour roles.
- `git diff --check`: PASS. Không sửa `budget-picker.ts`.
- Logs lần reconcile cuối: `/tmp/mobile-600-r6e-{typecheck,lint,ui,vitest}.log`.
  Danh sách suite: `/tmp/mobile-600-r6e-{jest,vitest}-specs.json`.
  SHA-256 manifest `/tmp/mobile-600-r6e-source-manifest.json` xác nhận toàn bộ
  1115 source entries không đổi trong lúc chạy các checks cuối.
- Đây là component/pure logic verification; chưa chụp hoặc nghiệm thu trên
  simulator trong round này.

## Wizard: bước cuối là địa điểm, không bắt buộc

- Couple: `type → time → budget → places` (4 bước).
- Group: `type → group-setup → time → budget → places` (5 bước).
- Budget dùng “Tiếp tục”, đích `/create/places`.
- `create-places.view/style.tsx`, route `src/app/create/places.tsx`.
- Vi: “Địa điểm muốn gợi ý” / “Không bắt buộc — GoGo sẽ ưu tiên đưa vào phương án.”;
  en: “Places to suggest” / “Optional — GoGo will prioritize these places in the plan.”
- Selected seeds ở đầu dùng PlaceCardSmall và X góc phải trên, cap
  `MAX_SEED_PLACES = 10`. Dấu + mở `/places/search` với cùng opaque pickerScope;
  giữ guard chống mở hai picker và cleanup scope khi đóng/unmount.
- Phía dưới là PlaceCardSmall results. Tap thêm/bỏ; glyph check/plus và
  `accessibilityState.selected` thể hiện selection. Đạt cap thì disable thêm
  (vẫn bỏ được) và hiển thị limit hint hiện có.
- CTA “Tạo GoGo Room” + arrow nằm ở bước này, tạo với zero seeds được phép;
  lỗi/empty của list không bắt buộc chọn seed để tiếp tục.

`create-places-query.ts` tạo params cho `usePlaceSearch`, cùng query layer và
BFF generated client wrapper mà picker dùng (`GET /places/search`):

| Điều kiện | Params |
| --- | --- |
| Administrative draft | datasetVersion, provinceCode, communeCode nếu có |
| GPS draft | lat/lng của origin và radiusM; GPS không giới hạn dùng administrative area vừa resolve đúng fix như picker cũ |
| Budget per_person | priceMaxPerPerson = budgetAmount |
| Budget total | floor(budgetAmount / participantCount), couple luôn 2 và dùng effective total mode như create payload |
| Budget none/unset (0/null) | Không gửi priceMaxPerPerson |
| Audience | suitedFor = couple/group |
| Pagination | limit=10, cursor; locale=vi/en |

List có skeleton trang đầu, empty “Chưa có địa điểm phù hợp — bạn vẫn tạo
phòng được”, error/retry, offline, pull-to-refresh trang đầu, load more/spinner,
footer retry giữ các hàng đã tải. Query không chạy nếu thiếu scope hợp lệ;
copy seed-scope-unavailable giữ nguyên ý nghĩa. Toàn bộ list states có bottom
padding theo GlassBar đo được. Không thêm fallback sang global discovery area.

## Create transaction và state/analytics đã bỏ

Logic tạo phòng nằm tại **`src/features/create-date/use-create-room-draft.ts`**:
account/budget validity guard → fingerprint + idempotency key →
`saveRoomDraft(owner, 'places')` trước request → `createRoom` → `rememberRoom`
→ `noteAssistantPlanCreated` → `finishDraft` → `clearSavedRoomDraft` →
`gogo_room_created` → replace room route. Giữ ADMINISTRATIVE_VERSION_CHANGED,
field_errors và generic createFailed copy, submit lock và creationPending overlay.
Timeout retry giữ key; thay request thì đổi fingerprint/key.

Đã xoá event `date_context_completed` cùng mood/setting/spending payload và
entry của event trong analytics type. Giữ `gogo_room_created`.

RoomStore không còn `moodKeys`, `settingKeys`, `spendingStyleKey`,
`preferenceSeed`. `finishDraft()` chỉ reset create draft. Preference screen
khởi đầu rỗng nếu phòng chưa lưu sở thích; vẫn đọc selection đã lưu của phòng
và vẫn có nút dùng sở thích đã lưu từ profile. Không truyền host picks từ
wizard; host chọn như mọi member. Xoá cleanup preferenceSeed trong logout.

Xoá `create-mood.view/style.tsx`, `create-mood-fields.view/style.tsx` và route
`src/app/create/mood.tsx`. Xoá createMood.*; strings seed/create dùng namespace
`createPlaces.*`, cả picker và room manage đã đổi consumer.

## Draft và deep-link migration

- Giữ storage key/version, đọc được v1/v2. Zod bỏ retired preference fields
  từ snapshot cũ thay vì từ chối snapshot; fields mới không cần chúng.
- `draftStepSchema` vẫn đọc legacy `mood`/`location`.
  `currentDraftStep`: mood → places, location → type. Save chỉ phát step hiện tại.
- `restoreRoomDraft` và `draftStepPath` chuyển bước cũ; resumed navigation
  dựng stack đúng type/group-setup/time/budget/places để Back hoạt động.
- `systemPathFor` (được `+native-intent` gọi cho cold/warm OS links) chuyển
  `/create/mood`, scheme URL và web URL cùng shape sang `/create/places`.
  Route mood không còn trong filesystem. Post-auth `next=create` và screen
  telemetry cũng dùng places.
- Đã kiểm `wizard-modal.ts`, exit prompt và create entry: modal lifecycle không
  mã hoá mood; exit actions dùng DraftStep và save đã normalize. Không cần
  sửa lifecycle helper chỉ vì đổi route.

## Đọc BE: địa điểm chưa biết giá bị loại khi có priceMaxPerPerson

Checkout đọc-only:
`/Users/maxnguyen/MyWorks/GoGo/GoGo-BE/libs/modules/search/infrastructure/search.repository.ts`.

- Dòng **255–258**: có priceMaxPerPerson thì thêm `lp.price_min <= ceiling`.
- Dòng **316–322**: LEFT JOIN lấy price mới nhất, unit `per_person`, từ place_prices.

Không có row giá per_person hoặc lower bound là NULL thì predicate không true,
nên địa điểm bị loại khỏi results khi có trần giá. Không sửa hành vi này.
Không gửi trần giá thì predicate này không được thêm.

## Confirm trong gogo-room → ResultSheet

| Confirm đã thay | File / testID | Hành vi |
| --- | --- | --- |
| Huỷ phòng | `room-manage.view.tsx` / `room-manage-confirm` | warning ResultSheet; giữ title/body, “Huỷ” secondary trái, “Huỷ phòng” danger phải, cùng flex=1. Danger busy khi request chạy; khoá duplicate/close/cancel; lỗi dùng roomManage.saveFailed, ở lại sheet và retry được; success về Plans. |
| Xoá thành viên | `room-manage.view.tsx` / `room-manage-confirm` | giữ tên/copy, danger “Xoá”, cùng busy/error/retry và cancel path. |
| Thay phiên khách (cả link mời và nhập mã) | `guest-replace-notice.view.tsx` / `guest-replace-confirm` | secondary giữ phiên/danger thay và tham gia; dismiss = false. Resolve sau native onClosed; chỉ sau đó join screen bật submit overlay/request. Cả hai màn có synchronous guard chống submit trùng. |

Bỏ transition/remove-member khỏi blocking overlay của manage để busy hiển thị
ngay trên danger button trong sheet. Các mutation khác vẫn dùng overlay cũ.
Invite replacement và stale-conditions confirmation đã dùng ResultSheet, giữ lại.
Không tìm thấy centred leave-room confirm riêng trong gogo-room hiện tại.

Các `confirm()` ngoài gogo-room giữ nguyên:

- `src/features/account/account.view.tsx:145` — unsaved account edits.
- `src/features/assistant/history.view.tsx:96` — xoá conversation.
- `src/features/create-date/wizard-actions.view.tsx:47` — wizard exit, vốn có
  WizardExitPrompt adapter (ba nút trong một hàng).
- `src/shared/location/current-area-sheet.view.tsx:60` có local function tên
  confirm để áp dụng lựa chọn khu vực; không phải centred confirmation dialog.
- `src/shared/ui/dialog.view.tsx:112` chỉ là ví dụ trong comment.

## Kiểm chứng round 6b

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, 0 errors; 4 warning require-import có sẵn trong hai
  assistant specs không đổi.
- Targeted Jest: **24 suites / 503 tests PASS** — toàn bộ create-date specs;
  edit screen/regressions; confirm dialogs; manage feedback; room state matrix;
  guest join/replacement và join-by-code; preference/budget prefill; wizard
  exit; session-invite purge; Plans draft.
- Focused Vitest: **9 files / 163 tests PASS** — room draft, saved draft,
  native intent, post-auth route, room editor/schedule, submit overlay, header
  ownership, color roles.
- `git diff --check`: PASS.

Log lệnh/kết quả: `/tmp/mobile-600-r6b-{typecheck,lint,ui,vitest}.log`.
Tests chỉ Mood được xoá thật (không skip); các ca mixed giữ phần lịch/khu vực.
Footer-state coverage thay bằng places list tests. Specs điều khiển VirtualizedList
batching timers trong act và giữ callback native dismissal trước khi sheet unmount. New tests kiểm zero-seed,
idempotent retry/fingerprint, create errors, budget filters sent qua search
query layer, list states/cap/selection, legacy v2 draft/deep link và sheet
cancel/confirm/busy/error/retry ở Light/Dark. Header/color inventories cập nhật
theo view đã chuyển/xoá; không đổi token màu.

Chưa chạy simulator/device/live BFF; kết quả local không phải native visual,
CI hay DEV acceptance.

## Danh sách file của cây dirty hiện tại

Bao gồm round 6 được giữ lại và round 6b ở trên; trạng thái so với HEAD,
không phải tất cả đều bắt đầu trong round 6b. Các file mood-fields và
use-room-edit-preferences chưa tracked ở round 6 đã được xoá khỏi cây.

### Production / route / tài liệu

- `docs/redesign/issue-595-unified-room-edit.md`
- `src/app/+native-intent.tsx`
- `src/app/create/_layout.tsx`
- `src/app/create/mood.tsx`
- `src/features/auth/post-auth-route.ts`
- `src/features/create-date/create-budget.view.tsx`
- `src/features/create-date/create-location-fields.view.tsx`
- `src/features/create-date/create-mood.style.tsx`
- `src/features/create-date/create-mood.view.tsx`
- `src/features/create-date/create-time.view.tsx`
- `src/features/create-date/date-time-sheet.view.tsx`
- `src/features/create-date/wizard-actions.view.tsx`
- `src/features/create-date/wizard-step.view.tsx`
- `src/features/gogo-room/gogo-room.view.tsx`
- `src/features/gogo-room/guest-join.view.tsx`
- `src/features/gogo-room/guest-replace-notice.view.tsx`
- `src/features/gogo-room/join-by-code.view.tsx`
- `src/features/gogo-room/room-edit-fields.style.tsx`
- `src/features/gogo-room/room-edit-fields.view.tsx`
- `src/features/gogo-room/room-edit-sheet.style.tsx`
- `src/features/gogo-room/room-edit-sheet.view.tsx`
- `src/features/gogo-room/room-editor.style.tsx`
- `src/features/gogo-room/room-editor.view.tsx`
- `src/features/gogo-room/room-manage.view.tsx`
- `src/features/matching/preference.view.tsx`
- `src/features/search/search.view.tsx`
- `src/shared/analytics/index.ts`
- `src/shared/i18n/en.ts`
- `src/shared/i18n/vi.ts`
- `src/shared/location/current-area-sheet.view.tsx`
- `src/shared/navigation/deep-link.ts`
- `src/shared/observability/screen-templates.ts`
- `src/shared/providers/session-provider.tsx`
- `src/shared/store/roomStore.ts`
- `src/shared/store/savedRoomDraft.ts`
- `src/shared/ui/location-field.view.tsx`
- `src/app/create/places.tsx`
- `src/app/room/[roomId]/edit.tsx`
- `src/features/create-date/create-budget-fields.style.tsx`
- `src/features/create-date/create-budget-fields.view.tsx`
- `src/features/create-date/create-places-query.ts`
- `src/features/create-date/create-places.style.tsx`
- `src/features/create-date/create-places.view.tsx`
- `src/features/create-date/create-time-fields.style.tsx`
- `src/features/create-date/create-time-fields.view.tsx`
- `src/features/create-date/use-create-room-draft.ts`
- `src/features/gogo-room/room-edit-time.style.tsx`
- `src/features/gogo-room/room-edit-time.view.tsx`
- `src/features/gogo-room/room-edit.style.tsx`
- `src/features/gogo-room/room-edit.view.tsx`
- `src/features/gogo-room/use-room-edit-location.ts`

### Tests / inventories

- `src/features/__tests__/confirm-dialogs.spec.tsx`
- `src/features/__tests__/create-mood-footer-inset.spec.tsx`
- `src/features/__tests__/guest-join.spec.tsx`
- `src/features/__tests__/guest-replace-confirm.spec.tsx`
- `src/features/__tests__/prefill-budget.spec.tsx`
- `src/features/__tests__/prefill-preference.spec.tsx`
- `src/features/__tests__/room-manage-feedback.spec.tsx`
- `src/features/__tests__/room-state-matrix.spec.tsx`
- `src/features/__tests__/session-invite-purge.spec.tsx`
- `src/features/__tests__/wizard-exit.spec.tsx`
- `src/features/auth/post-auth-route.test.ts`
- `src/features/create-date/__tests__/budget-picker.spec.tsx`
- `src/features/create-date/__tests__/draft-navigation.spec.tsx`
- `src/features/create-date/__tests__/owner-feedback.spec.tsx`
- `src/features/create-date/__tests__/round-four.spec.tsx`
- `src/features/create-date/__tests__/round-seven.spec.tsx`
- `src/features/create-date/__tests__/round-six.spec.tsx`
- `src/features/create-date/__tests__/round-ten.spec.tsx`
- `src/features/create-date/__tests__/round-three.spec.tsx`
- `src/features/create-date/__tests__/round-two.spec.tsx`
- `src/shared/store/__tests__/room-draft.test.ts`
- `src/shared/store/__tests__/saved-room-draft.test.ts`
- `src/shared/ui/__tests__/app-header-ownership.test.ts`
- `src/shared/ui/__tests__/fixtures/stitch-color-pins.json`
- `src/shared/ui/__tests__/submit-overlay.test.ts`
- `src/features/__tests__/room-edit-regressions.spec.tsx`
- `src/features/__tests__/room-edit-screen.spec.tsx`
- `src/features/create-date/__tests__/create-places.spec.tsx`
- `src/features/gogo-room/__tests__/room-editor.test.ts`
