# #600 round 6h — sảnh phòng, members và seed places

Ngày 2026-11-12. Áp dụng §10 của brief owner trên tree sau round 6g.
Không commit, stash, push, merge hoặc deploy. Giữ và hoàn thiện các partial edits
ban đầu ở members/seeds, time caption, i18n và budget formatter.

## Hành vi đã đổi

- Sảnh theo thứ tự Điều kiện phòng → Thành viên → Địa điểm gợi ý → Quản lý
  (host-only). Header dùng tên trim/default, một dòng ellipsis; không hero,
  không invite card trong body, không placeholder code 6 chữ số.
- Host sửa thẳng edit; native share cạnh chuông. Nhóm Quản lý có trạng thái
  invite (remaining uses và thời điểm hết hạn), Đổi link và Huỷ phòng outline.
  Đổi link xác nhận, refetch/revoke mọi invite active, create rồi share.
  Huỷ thành công replace Plans; lỗi/busy/retry giữ trong ResultSheet.
- Members chung giữa inline/sheet: tối đa 5 hàng; group >5 có Xem tất cả (N).
  Chỉ host được mời thành viên khác ra, không có action ở chính mình/host,
  không transfer-host placeholder. Remove dùng một transaction rồi refetch.
- Seed PlaceCardSmall có hydration/skeleton/error/retry và empty copy. Host
  dùng +/X với scope picker và ResultSheet confirm; member/guest chỉ đọc.
  Pull-to-refresh cập nhật room, invite metadata và mọi seed detail.
- Facts theo tên (nếu có), khu vực, ngân sách có đơn vị, lịch dùng formatter
  overnight chung; không có lịch thì không hàng. Bỏ caption “Lịch tùy chỉnh”
  khỏi edit/wizard; giữ presets/estimate trong wizard.
- Auto-invite chạy nền sau create, không giữ navigation hoặc báo lỗi lobby.
  Active metadata và pending task ngăn tạo trùng khi retry/header tap sớm.
  Mã mới chỉ ở session query cache, không persist/log. Legacy SecureStore
  entries vẫn đọc/xoá được. API không trả lại code của active invite: nếu không
  giữ secret trên thiết bị này thì xác nhận đổi link trước khi revoke/create.
- Dùng useSubmitOverlay để share sau native dismissal, kể cả phản hồi nhanh
  được React batch mà overlay chưa từng mount. Routing hold giữ lobby trong
  thời gian confirm/request/share; Android giữ tới khi quay lại app/grace.

## Route và screen tag

- Xoá `room-manage.view.tsx` và `room-manage.style.tsx`.
- `/room/[roomId]/manage` giữ đúng một thin re-export sang
  `room-legacy-redirect.view.tsx`, chỉ render Redirect tới `/room/${roomId}`.
  Shim cần cho restored nav state; native-intent/systemPathFor cũng rewrite
  deep link scheme, web và bare path về lobby. Không có màn quản lý thật.
- SCREEN_TEMPLATES bỏ `/room/[roomId]/manage`; screen-tag spec loại đúng shim
  này khỏi inventory screen và kiểm tra nó không được tag như screen.
- Suggestion notice “sửa điều kiện” → edit. Edit lưu thành công/back về lobby,
  khi không có stack replace lobby. Router thật kiểm tra legacy redirect.

## TestIDs

| Thao tác/vùng | testID |
| --- | --- |
| Lobby title | `room-lobby-header-title` |
| Header invite | `room-lobby-invite` |
| Điều kiện phòng | `room-lobby-conditions` |
| Đổi link mời / confirm | `room-lobby-change-invite` / `room-lobby-invite-confirm` |
| Huỷ phòng / confirm | `room-lobby-cancel` / `room-lobby-cancel-confirm` |
| Nhóm Quản lý / status | `room-lobby-management` / `room-lobby-invite-status` |
| Xem tất cả / sheet | `room-lobby-members-all` / `room-lobby-members-sheet` |
| Inline / sheet member | `room-lobby-member-{index}` / `room-lobby-sheet-member-{index}` |
| Remove member / confirm | `room-lobby-remove-{memberId}` / `room-lobby-member-confirm` |
| Remove member trong sheet | `room-lobby-sheet-remove-{memberId}` |
| Seeds / thêm / confirm | `room-lobby-seeds` / `room-lobby-seeds-add` / `room-lobby-seed-confirm` |
| X của seed card | `place-card-remove` (a11y có tên địa điểm) |
| Scroll / bottom bar | `room-lobby-scroll` / `room-lobby-actions` |

## Kiểm chứng

Kết quả trên code hiện tại (không có thay đổi code sau lượt này):

| Gate | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errors; 4 warnings có sẵn ở assistant-keyboard-offset và assistant-usage-footer |
| Jest (`pnpm test:ui --runInBand …`) | PASS — 28 suites, 689 tests |
| Vitest chọn file (`pnpm exec vitest run …`) | PASS — 6 files, 64 tests |
| `git diff --check` | PASS |

Jest selection: `room-lobby room-state-matrix confirm-dialogs room-edit
suggestion-run-states list-first-load button-parent-geometry screen-tag
auto-room-invite room-invite room-manage-redirect draft-navigation budget-picker
room-status room-connection-screens room-schedule-chip room-area-chip i18n-keys
session-invite-purge app-header`.

Vitest files: `deep-link.test.ts`, `invite-state.test.ts`,
`room-schedule.test.ts`, `color-roles.test.ts`, `budget-unit.test.ts`,
`money.test.ts`. Lệnh dùng các path đầy đủ trong src/shared/navigation,
src/features/gogo-room, src/shared/ui và src/shared/pricing tương ứng.

Kết quả Jest chi tiết: `/tmp/round6h-verified-jest.json`; stdout các gate:
`/tmp/round6h-typecheck.log`, `/tmp/round6h-lint.log`,
`/tmp/round6h-verified-jest.log`, `/tmp/round6h-verified-vitest.log`.


Spec manage feedback/invites được retarget/đổi tên sang lobby. Assertion
manage-only/hero/invite-card/copy-code được bỏ theo quyết định mới và thay bằng
coverage header, read-only permissions, seed confirm, members sheet, redirect.
Không claim FAIL-before từ một checkout khác: tree đầu vào đã có partial edit;
baseline hành vi lấy từ source/diff. Các thất bại trong lúc port spec không
được ghi thành bằng chứng nghiệm thu DEV.

Một lệnh Vitest đầu tiên với dấu `--` đã vô tình chọn cả suite; đã dừng bằng
Ctrl-C sau khi distribution-wrapper tests báo lỗi process-liveness trong sandbox.
Kết quả đó không phải PASS toàn suite. Các lệnh Vitest ghi bên trên chọn đúng file.

## Giới hạn

- Chưa chạy simulator/thiết bị, chưa xác nhận native share/scroll/VoiceOver
  trên build thực tế; kết quả Jest không thay nghiệm thu UI.
- BE#878: member thêm/xoá seed của mình chưa có; BE#879: transfer host chưa có.
- Hero từng là nơi duy nhất trong sảnh giải thích mốc riêng tư “tới khi match/
  có kết quả”. Onboarding vẫn nói sở thích riêng tư; không thêm hero thay thế.
- Vì mã không persist, cold start không có secret của invite mới thì cần
  xác nhận Đổi link; không thể phục hồi link từ API metadata hiện tại.

## Files trong diff

- `docs/api-migration.md`
- `docs/chip-spacing-audit.md`
- `docs/redesign/issue-595-unified-room-edit.md`
- `docs/ui/loading-submit-audit.md`
- `docs/verification/PR-g11-profile.md`
- `docs/verification/issue-535.md`
- `docs/verification/issue-536.md`
- `docs/verification/issue-541-button-height.md`
- `docs/verification/issue-556-color-tokens.md`
- `docs/verification/issue-584-loading.md`
- `docs/verification/issue-595-group-05b.md`
- `docs/verification/issue-619.md`
- `src/app/room/[roomId]/manage.tsx`
- `src/features/__tests__/confirm-dialogs.spec.tsx`
- `src/features/__tests__/list-first-load.spec.tsx`
- `src/features/__tests__/room-edit-r6g.spec.tsx`
- `src/features/__tests__/room-edit-screen.spec.tsx`
- `src/features/__tests__/room-invite-reopen.spec.tsx`
- `src/features/__tests__/room-invite.spec.tsx`
- `src/features/__tests__/room-lobby-plus.spec.tsx`
- `src/features/__tests__/room-manage-feedback.spec.tsx`
- `src/features/__tests__/room-manage-invites.spec.tsx`
- `src/features/__tests__/room-state-matrix.spec.tsx`
- `src/features/__tests__/room-status-routing.spec.tsx`
- `src/features/__tests__/suggestion-run-states.spec.tsx`
- `src/features/create-date/create-time-fields.view.tsx`
- `src/features/create-date/use-create-room-draft.ts`
- `src/features/gogo-room/gogo-room.style.tsx`
- `src/features/gogo-room/gogo-room.view.tsx`
- `src/features/gogo-room/room-edit-fields.style.tsx`
- `src/features/gogo-room/room-edit-fields.view.tsx`
- `src/features/gogo-room/room-edit-time.view.tsx`
- `src/features/gogo-room/room-edit.view.tsx`
- `src/features/gogo-room/room-editor.view.tsx`
- `src/features/gogo-room/room-manage.style.tsx`
- `src/features/gogo-room/room-manage.view.tsx`
- `src/features/gogo-room/room-schedule.ts`
- `src/features/matching/suggestion-run-notice.view.tsx`
- `src/shared/api/queries/use-rooms.ts`
- `src/shared/i18n/en.ts`
- `src/shared/i18n/vi.ts`
- `src/shared/navigation/__tests__/deep-link.test.ts`
- `src/shared/navigation/deep-link.ts`
- `src/shared/observability/__tests__/screen-tag.spec.tsx`
- `src/shared/observability/screen-templates.ts`
- `src/shared/pricing/budget-unit.ts`
- `src/shared/ui/__tests__/button-parent-geometry.spec.tsx`
- `src/shared/ui/__tests__/fixtures/stitch-color-pins.json`
- `src/shared/ui/app-header.view.tsx`
- `src/shared/ui/button.view.tsx`
- `src/features/__tests__/room-lobby-feedback.spec.tsx`
- `src/features/__tests__/room-lobby-invites.spec.tsx`
- `src/features/__tests__/room-lobby-members.spec.tsx`
- `src/features/__tests__/room-manage-redirect.spec.tsx`
- `src/features/create-date/__tests__/auto-room-invite.spec.tsx`
- `src/features/gogo-room/prepare-room-invite.ts`
- `src/features/gogo-room/room-host-actions.style.tsx`
- `src/features/gogo-room/room-host-actions.view.tsx`
- `src/features/gogo-room/room-legacy-redirect.view.tsx`
- `src/features/gogo-room/room-members.style.tsx`
- `src/features/gogo-room/room-members.view.tsx`
- `src/features/gogo-room/room-seeds.style.tsx`
- `src/features/gogo-room/room-seeds.view.tsx`
- `docs/verification/issue-600-round-6h.md` (báo cáo này)
