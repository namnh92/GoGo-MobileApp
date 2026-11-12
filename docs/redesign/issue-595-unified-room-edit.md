# PR #600 / issue #595 — chỉnh sửa kèo chung

Ngày: 2026-11-12. Base kiểm tra: `f82e5d05`. Thay đổi local, không commit.

## 1. Đối chiếu wizard 05A và API hiện có

Đã đọc `src/features/create-date/*`, `toCreateRoomBody` trong
`src/shared/store/roomStore.ts`, generated `src/shared/api/schema.d.ts`,
`openapi/gogo.v1.yaml` và các mutation trong `src/shared/api/queries`.

| Thuộc tính người dùng chọn khi tạo | API sửa kèo đã tạo | Xử lý trong thay đổi này |
| --- | --- | --- |
| Loại kèo: hai người / nhóm | Không có endpoint đổi `type`; `decisionMode` được suy ra khi tạo | Không thêm control |
| Tên kèo, có thể để trống | `useRenameRoom` → title endpoint; `null` bỏ tên | Input + bộ đếm 80 ký tự; chỉ gọi khi tên sau trim khác |
| Tỉnh/thành phố, phường/xã hoặc toàn tỉnh | `useUpdateRoomConstraints`: `administrativeArea` | AdministrativePicker embedded; chọn danh sách toàn chiều cao; chọn thủ công xoá originLat/originLng/radiusM theo F-04 |
| Vị trí hiện tại GPS | Cùng constraints endpoint: `originLat`, `originLng`, `administrativeArea: null` | Dùng `useCurrentLocation`; chỉ thay origin sau thao tác chọn rõ ràng; origin cũ không được API đọc trả lại nên giữ bằng omission |
| Khoảng cách GPS: 2/5/10 km / không giới hạn | Cùng constraints endpoint: `radiusM`; `null` xoá giới hạn | Chip theo wizard, chỉ có khi scope GPS; chọn khu vực thủ công xoá khoảng cách |
| Số người dự kiến (nhóm; wizard 3–12) | Cùng constraints endpoint: `participantCount` | Stepper của nhóm; API cho phép 2–20 nên không chặn tên của kèo cũ ngoài dải wizard |
| Đơn vị ngân sách nhóm: mỗi người / tổng nhóm | Cùng constraints endpoint: `budgetMode` | Chip nhóm; kèo hai người giữ mode đang lưu, không tự chuyển đổi |
| Mức ngân sách | Cùng constraints endpoint: `budgetAmount`, integer minor units | Chip tier với đơn vị; không chia theo số người |
| Ngày/giờ bắt đầu, giờ kết thúc; preset ngày/giờ/thời lượng | Cùng constraints endpoint: `startAt`, `endAt` | Hai input hiện có; preset chỉ suy ra hai timestamp; mỗi đầu không đổi được bỏ khỏi payload; xoá end gửi `null` |
| Mood | Không có thuộc tính mood của room để host sửa; `useSaveMyPreferences` là draft riêng của chính người dùng | Không thêm vào form điều kiện chung; giữ luồng chọn sở thích riêng |
| Không gian / setting | Không phải thuộc tính room; wizard giữ `settingKeys` trong draft, không gửi trong create-room body | Không thêm control sửa room |
| Phong cách chi tiêu | Không phải thuộc tính room; wizard giữ `spendingStyleKey` trong draft, không gửi trong create-room body | Không thêm control sửa room |
| Địa điểm gợi ý | `useAddRoomSeedPlaces` / `useRemoveRoomSeedPlace`, không nằm trong constraints PATCH | Giữ card thêm/xoá địa điểm hiện có trên manage; không gộp luồng search và các mutation này vào form điều kiện |

`currency` không phải lựa chọn trong wizard: giữ nguyên currency của phòng.
`decisionMode`, dữ liệu home/usual-budget gợi ý và preset không phải thuộc tính
độc lập được thêm vào form.

**Giới hạn contract:** `RoomConstraintPatch` bắt buộc `budgetMode` và
`budgetAmount` trên *mọi* PATCH (`schema.d.ts` phần RoomConstraintPatch và
`openapi/gogo.v1.yaml` phần required). Vì vậy area/schedule/count/distance-only
vẫn phải kèm cặp budget đang lưu và `expectedConstraintVersion`. Các key optional
không đổi bị bỏ hoàn toàn. `currency` chỉ gửi khi ngân sách/mode thay đổi.
Không sửa schema, BE hoặc OpenAPI để giả vờ hỗ trợ PATCH thiếu cặp bắt buộc.
Strict changed-only cho cả hai budget key cần một contract change riêng.

Các flow địa điểm và sở thích vẫn tách riêng như nêu trong bảng. Đây là giới hạn
phạm vi cần owner biết khi đánh giá yêu cầu “tất cả thuộc tính”.

## 2. Hành vi và file

- Manage giữ bốn dòng Tên kèo → Khu vực → Ngân sách → Ngày giờ kèo; một Sửa ở header mở “Chỉnh sửa kèo”. Không còn Sửa theo dòng hoặc Lưu tên.
- Form `react-hook-form` + zod, một hàng Huỷ trái / Xác nhận phải. Không thay đổi hoặc invalid thì disabled. Title-only không mở cảnh báo stale.
- Title endpoint chạy trước, sau đó một constraints PATCH gộp các thay đổi. Overlay dùng LoadingIndicator chung; chặn chip, input, submit lặp và mọi đường đóng sheet trong khi gửi.
- Thành công từng endpoint được ghi vào baseline. Lỗi giữ sheet/draft với tên các field thất bại; retry không gửi lại title đã thành công. Sau một PATCH thành công, edit tiếp trong sheet dùng version mới trả về.
- Không spread room.constraints vào request. Schedule không đổi giữ nguyên cả seconds/milliseconds của server bằng omission.
- Lobby giữ Sửa host-only và tiếp tục điều hướng tới manage.
- Không claim nghiệm thu trên simulator, DEV hoặc production từ Jest.

File chính:

- `src/features/gogo-room/room-manage.view.tsx`, `.style.tsx`: header action + facts không có per-row action; bỏ state/save handlers cũ.
- `src/features/gogo-room/room-edit-sheet.view.tsx`, `.style.tsx`: một native sheet và embedded ResultSheet; bỏ API per-row editor.
- `src/features/gogo-room/room-editor.ts`, `.view.tsx`, `.style.tsx`: schema, snapshot/dirty tracking, form và orchestration.
- `src/features/gogo-room/room-edit-fields.view.tsx`, `.style.tsx`: tái sử dụng title input theo wizard và schedule fields hiện có, label thẳng hàng.
- `src/shared/administrative/administrative-picker.view.tsx`: thêm lựa chọn controlled cho level danh sách; caller cũ giữ mặc định uncontrolled. Giữ draft khi đổi giữa form scroll và danh sách toàn chiều cao.
- `src/shared/i18n/{vi,en}.ts`: tên sheet, lỗi theo field, bỏ key saveTitle và copy editor cũ không còn dùng.
- Xoá `room-title-editor.view.tsx`, `room-schedule-editor.view.tsx` và hai suite riêng cũ; chuyển regression liên quan vào hai suite dưới.
- `src/shared/ui/__tests__/chip.spec.tsx`: chuyển inventory spacing từ tierRow cũ sang chips của editor, giữ invariant 4pt.
- `src/shared/ui/__tests__/submit-overlay.test.ts`, `fixtures/stitch-color-pins.json`: chuyển inventory overlay sang owner form chung và pin các role bindings đã chuyển; giữ kiểm chứng cả rename + constraints pending.
- `src/features/__tests__/room-manage-feedback.spec.tsx`, `confirm-dialogs.spec.tsx`: cập nhật action chung, sparse payload, partial failure, states/permission, budget/GPS/group, full-height picker và layout labels.

## 3. Kiểm chứng

Các lệnh chạy tuần tự:

| Lệnh | Kết quả cuối |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS; 0 errors, 4 warnings require-import trong hai file assistant test không thay đổi |
| `pnpm test:ui --runInBand` | PASS — 257 suites, 4.147 tests, 11 snapshots |
| `pnpm exec vitest run src/shared/ui` | PASS — 21 files, 332 tests |
| `git diff --check` | PASS |

Focused UI proof: 126 tests PASS trong `room-manage-feedback.spec.tsx` và
`confirm-dialogs.spec.tsx`, gồm các tình huống owner yêu cầu: prefill + một Sửa;
title-only không constraints/không confirm; budget-only; area+schedule chung;
unchanged/invalid disabled; partial failure không gửi lại phần thành công;
member/guest không có Sửa. Có thêm regression cho F-04, picker full-height giữ
các field đã gõ, scope GPS, count/mode nhóm, version mới sau save, locked states,
vi/en labels và Light/Dark state matrix.

Full UI run đầu bắt lỗi inventory spacing còn trỏ vào tierRow đã bỏ; đã chuyển
inventory sang row đang dùng rồi full-run lại xanh. Vitest đầu bắt inventory
file editor đã xoá và role bindings đã chuyển; đã cập nhật đúng owner/bindings,
không bỏ assertion, rồi chạy lại xanh. Typecheck và lint cũng được chạy lại sau
cập nhật inventory. Runtime code không đổi sau full Jest run xanh.

Log local:

- `/tmp/mobile-595-typecheck.log`
- `/tmp/mobile-595-lint.log`
- `/tmp/mobile-595-ui-final.log`
- `/tmp/mobile-595-vitest-final.log`

HEAD vẫn `f82e5d05`, branch `feature/GOGO-595-redesign-g05b-room`.
Không commit/push; không có thay đổi BE/OpenAPI. Chưa đo native layout trên
simulator và chưa claim CI/DEV acceptance.
