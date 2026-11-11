# GoGo-MobileApp #595 — nhóm 05B

Ngày: 2026-11-10, round 2 trên `379a5eb`. Phạm vi: UI-only, không commit, không push.
Trạng thái: **chưa nghiệm thu 100% Stitch**. Đã sửa F-01/F-02/F-03 và ghép tên + lịch vào một sheet UI-only;
chưa có ảnh app Light/Dark cạnh Stitch vì CoreSimulatorService không truy cập được trong sandbox.
Các lệch còn lại trong bảng bên dưới không được hiểu là đã được duyệt. Không có ảnh native mới trong round 2.

## Nguồn và revision

- Round 1: issue được đọc qua GitHub connector: <https://github.com/namnh92/GoGo-MobileApp/issues/595>.
  `gh issue view 595 --repo namnh92/GoGo-MobileApp` thất bại kết nối `api.github.com`.
- Nhánh: `feature/GOGO-595-redesign-g05b-room`.
- HEAD khi bắt đầu/kết thúc round 2: `379a5eb737b0da0d0db3c6c84c6de2117d08ba13`.
  Round-1 base là `c87ed82`; giữ nguyên nhánh, không reset/rebase/commit/push.
- Đã đọc lại `dev/handoffs/codex-595.md` và `codex-review-request-595.sa.out` từ workspace cha.
  Lệnh round 2 của owner cho phép ghép sheet UI-only, giữ riêng mutation/handler/validation.
- Đã đọc `RTK.md` tại `~/.claude/RTK.md`, các rule `core`, `git`, `stitch-design`,
  `design-system`, `quality-gates`, `execution-policy`, cùng skill UI/Mobile/QA của workspace.
- Đã dùng Stitch MCP `list_screens`, `get_screen`, `download_file` để đọc HTML **và ảnh** cả 5 màn.
  Round 2 đọc lại inventory, HTML và ảnh cả 5 màn qua MCP. Không ghi/sửa project Stitch.
  Inventory không có Dark cùng tên; Dark dùng AppToken Light/Dark chung
  theo chỉ dẫn owner 2026-11-10. Không tự tạo bản Dark giả để chạy `parity.py`.
- `parity.py` trên cặp HTML Stitch: **NOT RUN**, không có cặp HTML Dark trong project cho 5 tên này.
  Test render hai theme scope chỉ chứng minh nội dung/quyền/trạng thái; không thay thế native visual parity.

## Đối chiếu từng màn

| Màn | Stitch | Light — phần đã dựng | Dark | Kết quả ảnh cạnh nhau |
| --- | --- | --- | --- | --- |
| 5.10 Phòng hẹn đôi | `10287728079123409484`, 780×2590 | Hero có badge couple, mã thật/copy/share theo capability, điều kiện theo thứ tự khu vực → lịch → ngân sách, roster thật, sở thích trước start. Không dựng người chưa tham gia. | Cùng component, màu theo theme semantic. | BLOCKED; chưa xác nhận 100%. |
| 5.11 Phòng chờ nhóm | `14565909522755492896`, 780×2058 | Header mời nhóm; bỏ hero hai avatar; điều kiện có nhãn; các member là hàng riêng, badge role/status, số N và progress thật. Edit dùng route manage sẵn có; GlassBar floating cố định CTA ngoài ScrollView, inset theo chiều cao bar thật. | Cùng component và AppToken. | BLOCKED; chưa xác nhận 100%. |
| 5.12 Phòng chờ nhóm (Khách) | `18430637797999520424`, 780×2212 | Hero chung; điều kiện readonly; roster, trạng thái chờ host và chọn sở thích. Không lộ mã/share/start/edit host-only. | Cùng component và AppToken. | BLOCKED; chưa xác nhận 100%. |
| 5.13 Quản lý phòng | `2792671546852313500`, 780×3396 | Cảnh báo stale đầu màn; điều kiện dạng hàng mở sheet; seed dùng PlaceCardSmall; member/remove và confirmations giữ nguyên; metadata lời mời/revoke; thẻ quyền host và vùng nguy hiểm. | Cùng component và AppToken. | BLOCKED; chưa xác nhận 100%. |
| 5.14 Chỉnh sửa phòng hẹn | `10863076915262487091`, 780×1768 | Shared Sheet/AppHeader, một sheet chứa đồng thời tên và lịch. Hai hàng Sửa cùng mở sheet này; Lưu tên (secondary) và Lưu lịch (primary) giữ nguyên từng mutation/validation. Huỷ ở trái Lưu lịch qua SheetActions. Khoá cả hai form và mọi đường đóng khi một mutation pending. | Cùng component và AppToken. | BLOCKED; phần lịch của chính ảnh Stitch còn thiếu. |

### 5.14 — phần HTML có nhưng ảnh chưa xác nhận

HTML có gợi ý nhanh tên, chip Hôm nay/Ngày mai/Thứ Bảy 26/10, giờ Sài Gòn GMT+7,
input `type=time` bắt đầu `18:30` và kết thúc `22:00`, thời lượng `~3.5 tiếng`,
nhãn “Lý tưởng cho cà phê & tối”, thông báo cập nhật cho mọi thành viên.
Ảnh chỉ hiện tiêu đề, tên, counter 21/40, nhãn GỢI Ý NHANH và nút Lưu/Huỷ dọc.
Không xác nhận được từ ảnh: chip gợi ý, toàn bộ layout/spacing phần ngày/giờ/thời lượng,
notice và vị trí phần lịch trong chiều cao sheet. Không lấy giờ/ngày mẫu làm dữ liệu thật.
Nút dọc trong ảnh được thay bằng hàng ngang theo yêu cầu owner của task này.

## Bảng lệch — chưa tự phê duyệt

| Stitch element | Screen | Reason | Proposal |
| --- | --- | --- | --- |
| Mã/copy/share cho khách | 5.12 | Capability hiện tại chỉ cho host lấy/tạo/chia sẻ mã; API invite list không trả code. | Giữ nguyên quyền, ẩn với member/guest. Nếu muốn chia sẻ bởi member, owner cần quyết định quyền trước; không đổi API/auth trong #595. |
| Người ấy chưa vào phòng, tên/avatar mẫu | 5.10 | Không có member thật. Roster không có record của người chưa tham gia. | Không dựng member giả; chỉ hiển thị roster thật. |
| Số “đã chọn 8 địa điểm”, “Khởi tạo lúc 09:15”, “Tạo phòng lúc 10:15” | 5.10, 5.12, 5.13 | RoomMember hiện không có các số liệu/thời điểm này. | Draft GoGo-BE: “Bổ sung selectionCount và joinedAt/createdAt có định nghĩa rõ trong RoomMember BFF; chỉ trả thông tin người dùng có quyền xem; AC: dữ liệu thật, nullable, contract tests host/member/guest.” Không mở issue. |
| “Đã thống nhất sơ bộ”, “Sẵn sàng kết nối”, badge Trực tiếp tĩnh | 5.10 | Không có trường xác nhận đồng thuận/khả năng kết nối; realtime đã có RoomConnectionNotice thật. | Không thêm khẳng định tĩnh. Draft GoGo-BE nếu cần: “Định nghĩa trạng thái consensus/connection, giá trị và quyền đọc trong room summary; không suy từ room tồn tại.” |
| Ảnh, địa chỉ, rating Google/GoGo của seed | 5.13 | RoomSummary.seedPlaces chỉ có placeId/name; thiếu sample size và nguồn ảnh. | PlaceCardSmall nhận adapter partial, không dựng giá/rating/địa chỉ. Draft GoGo-BE: “Enrich seedPlaces bằng PlaceCard BFF: ảnh+attribution, địa chỉ, giá+unit, rating+source+sampleCount; nullable; không invent defaults; contract tests partial DTO.” |
| Mã mời/copy và “Thu hồi sẽ tạo mã mới” trong manage | 5.13 | List invite chỉ trả metadata; revoke hiện chỉ thu hồi, không mint. | Giữ revoke hiện hành và copy/share trong lobby qua code sẵn có; không giả code hoặc tự tạo mới. Không mở endpoint lấy lại secret. |
| Khu vực có nút Sửa | 5.13 | Manage hiện không có handler chỉnh khu vực; task cấm đổi navigation/logic. | Hiển thị khu vực thật readonly; liệt kê để owner quyết định workflow chỉnh khu vực trong task riêng. |
| Header shell “Room Lobby …”, profile, tab bar mẫu, chevron điều kiện không có handler | 5.10, 5.12, 5.13, 5.14 | Template shell/static control không phải chức năng/route của các màn hiện hành. | Dùng AppHeader và route app sẵn có theo task; không thêm shell/navigation hay chevron giả. |
| Success toast “Đã cập nhật … Vừa xong” và thông báo tự gửi đến mọi người | 5.13, 5.14 | HTML/demo không chứng minh save/push đã thành công. | Chỉ hiện notice từ kết quả mutation hiện hành; không khẳng định broadcast/push chưa được chứng minh. |
| Huỷ phòng “xóa mọi tin nhắn lịch trình” | 5.13 | Copy chưa có nguồn contract xác nhận xóa tin nhắn. | Giữ copy hiện hành: terminal, không khôi phục, mọi người mất quyền truy cập; giữ confirmation. |
| Gợi ý nhanh tên, date shortcut, duration/recommendation badge | 5.14 | Không có chức năng hiện hành; ngày/giờ/duration trong HTML là mẫu, recommendation không có nguồn. | Chưa xây; owner quyết định phạm vi riêng. Giữ input ngày/giờ và parser/validation hiện hành, không giả duration. |
| 40 ký tự, tên bắt buộc | 5.14 | Mâu thuẫn contract hiện hành: tối đa 80, tên trống xóa tên. | Giữ max 80 và nullable title, đã có test; không đổi data model/validation. |
| Một nút lưu đồng thời tên và lịch | 5.14 | Đã ghép **một sheet** theo lệnh owner round 2 (2026-11-10). Hai form vẫn lưu riêng qua handler hiện hành; không có atomic API. | Lưu tên (secondary), Lưu lịch (primary), notice lỗi/thành công riêng, không tự đóng khi save. Không thay payload/parser/validation. Nếu muốn một giao dịch atomic cần task logic/API riêng; không làm trong #595. |
| Trang 10/cursor/load-more cho member/seed/invite | 5.10–5.13 | Summary chứa roster/seed đầy đủ, invites không có cursor. Không đổi API/data model. | Đã thêm PullToRefresh dùng refetch hiện hành; vẫn render đủ N. Draft GoGo-BE: “Cursor pagination limit=10 cho room members/seed/invites; total/progress toàn phòng tách khỏi số dòng đã tải; đảm bảo quyền host/member/guest và realtime reconciliation.” Không mở issue. |

Không có dữ liệu thật ở khu vực/lịch/ngân sách lobby thì ẩn dòng. Giá luôn giữ unit từ budgetMode;
không đổi số tiền/divisor, không dùng “cả hai” cho nhóm. Không thêm dữ liệu sample của Stitch.

## Hành vi và test

- Không sửa shared API/auth/router/business model; các mutation payload, capability, alert/dialog confirmation,
  realtime, start matching, routing hold và invite verification giữ nguyên.
- UI bổ sung PullToRefresh trên lobby/manage, skeleton manage và offline state khi query chưa có dữ liệu.
- Ma trận lobby/manage render couple | group-host | group-guest × default | loading | empty | error
  trong cả hai ThemeScope. Guest default/empty manage render permission-denied thay cho host controls.
- Fixture `group-guest`: `myMemberId=me`, me là member + `isGuest:true`; host là member khác. Lobby kiểm tra badge Khách trên đúng hàng me và không có badge Chủ phòng trên hàng này.
- Schedule matrix đi qua RoomEditSheet/Sheet thật trong cả hai theme: lịch có start/end, empty không có lịch, mutation-pending và mutation-error; guest readonly.
- Manage matrix mở sheet combined qua cả hai hàng Sửa, kiểm tra name/start/end, pending từng mutation khoá cả hai form và mọi đường đóng, lỗi từng mutation không gọi mutation kia; guest bị chặn tại màn manage. Hai theme có test save riêng, giữ draft lịch sau rename, trim/max80, parser/validation, explicit endAt:null/version/budget.
- Có regression trim/null/max80,
  end-before-start, explicit endAt:null, version, unit, partial-matching capability và confirmations.
- ThemeScope trong Jest giữ context màu/text nhưng native ScopedTheme được mock: không phải bằng chứng
  về pixel/layout/native accessibility. Target/selected state dựa vào shared Button/Chip/Sheet.

## Regression FAIL-before / PASS-after

Command: `pnpm test:ui --runInBand src/features/__tests__/confirm-dialogs.spec.tsx src/features/__tests__/room-state-matrix.spec.tsx --testNamePattern='595 F-0'`.

Production sources được tạm nạp nguyên bản bằng `git show 379a5eb:<path>` rồi khôi phục patch trong `finally`;
không đổi HEAD/index. Cùng regression specs chạy trước và sau. Guest fixture mới không đổi dữ liệu host của regression.

| Finding | FAIL trên production sources @379a5eb | PASS trên working tree round 2 | Evidence |
| --- | --- | --- | --- |
| F-01 | 5 fail / 1 pass: không tìm thấy blocking overlay bên trong sheet modal; header/backdrop/Android back/accessibility escape đóng sheet. Cancel vốn đã disabled nên pass. | 6 pass: overlay là descendant của sheet modal; tất cả chip disabled; chọn B không đổi A khi request A chưa xong; mọi close path bị chặn; hết pending có thể Huỷ. | `/tmp/595-r2/fail-before.log`, `/tmp/595-r2/pass-after.log`; `confirm-dialogs.spec.tsx:168–208` |
| F-02 | 2 fail: cả Light/Dark đều tìm thấy CTA sở thích bên trong scroll content. | 2 pass: nhóm 30 người, CTA ngoài ScrollView trong GlassBar; measured bar height cập nhật content inset; route sở thích giữ nguyên. | Cùng hai log; `room-state-matrix.spec.tsx:333–348` |

5.11 HTML có `fixed bottom-0` cho action bar và `pb-44` cho content. 5.10 chỉ cố định shell tab nav;
Action Deck vẫn inline trong main dù comment ghi “Pinned”. 5.12 có Bottom Action Card trong content,
không có fixed bottom CTA. Vì vậy chỉ 5.11 dùng floating GlassBar; test giữ CTA inline cho couple/guest
ở `room-state-matrix.spec.tsx:352–358`.

## Kiểm tra round 2

| Command | Kết quả | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/595-r2/typecheck.log` |
| `pnpm lint` | PASS, exit 0, không có diagnostics; không sửa `scripts/generate-brand-icons.mjs` | `/tmp/595-r2/lint.log` |
| Affected specs: confirm-dialogs, room-state-matrix, room-schedule-editor, room-title-editor, room-lobby-plus, room-schedule-chip | PASS: 6 suites / 174 tests; full gate bên dưới chạy lại trên patch cuối | `/tmp/595-r2/affected.log` |
| F-01/F-02 regression command ở trên | PASS, exit 0: 2 suites / 8 tests (116 tests ngoài filter skipped) | `/tmp/595-r2/pass-after.log` |
| `pnpm test` | Exit 1: 1743 pass / 39 skipped / đúng 3 lỗi distribute-wrapper đã biết trong sandbox; submit-overlay guard PASS sau cập nhật hai overlay bindings | `/tmp/595-r2/unit.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 232 suites / 3485 tests / 11 snapshots | `/tmp/595-r2/ui.log` |
| `git diff --check` | PASS | Không có whitespace errors. |

Round 2 còn đúng ba lỗi Vitest như round 1 ở `src/shared/config/__tests__/distribute-wrapper.test.ts`:
`refuses while the owner is alive`, `refuses recovery while a recorded build process group is still alive`,
`keeps the lock and run files when a recorded build group is still alive after the child exits`.
Đây là nhóm process/liveness trong sandbox mà task giao Claude chạy lại bên ngoài; chưa coi Vitest toàn bộ xanh.
Không sửa wrapper/test wrapper hoặc bypass sandbox để đổi kết quả.
Ảnh app: BLOCKED. Round 2 chạy lại `rtk xcrun simctl list devices booted`, exit 1: CoreSimulatorService connection invalid,
Operation not permitted, không khởi tạo được device set (`/tmp/595-r2/simulator.log`). Không đổi permission mode, không bypass sandbox.
0/5 màn có đối chiếu ảnh app Light/Dark cạnh Stitch trong round 2; không nhận nghiệm thu pixel/native Modal từ Jest.
Không thể ghi workspace handoff map ngoài writable root; báo cáo này là artifact trong worktree #595.


## Files:dòng đã đổi round 2

Các vị trí dưới đây là working tree round 2 so với HEAD `379a5eb`; dùng `git diff` làm nguồn khi review.

| File | Dòng thay đổi chính |
| --- | --- |
| `src/features/gogo-room/room-manage.view.tsx` | 59–61, 162, 178–204: combined editor/pending; budget overlay trong sheet và chip disabled |
| `src/features/gogo-room/room-edit-sheet.view.tsx` | 11–37: pending guard chung, header disabled, hai trigger chung một sheet |
| `src/features/gogo-room/room-title-editor.view.tsx` | 27, 39, 57, 78, 92–97: pending callback, khoá chung, save label/secondary |
| `src/features/gogo-room/room-schedule-editor.view.tsx` | 37, 50, 111, 128–132: pending callback, khoá chung, save label |
| `src/features/gogo-room/gogo-room.view.tsx` | 48, 117–118, 517–586, 607, 758, 772: shared action deck + fixed GlassBar/inset trên 5.11 |
| `src/features/gogo-room/gogo-room.style.tsx` | 7: action gap theo token |
| `src/shared/i18n/vi.ts` | 827–829: combined sheet title / Lưu tên / Lưu lịch |
| `src/shared/i18n/en.ts` | 846–848: combined sheet title / Save name / Save schedule |
| `src/features/__tests__/harness.tsx` | 71, 73: guest fixture nhất quán với myRole/myMemberId |
| `src/features/__tests__/room-state-matrix.spec.tsx` | 313–317, 333–358: guest badge, fixed CTA regression / inline couple-guest |
| `src/features/__tests__/confirm-dialogs.spec.tsx` | 17–24, 53–54, 71–72, 148, 168–302: F-01, combined real-sheet matrix hai theme và separate saves/validation |
| `src/features/__tests__/room-schedule-editor.spec.tsx` | 2–3, 15, 66–110: real-sheet matrix có lịch/empty/pending/error, hai theme |
| `src/shared/ui/__tests__/submit-overlay.test.ts` | 25–29, 68–70: inventory kiểm tra cả hai overlay bindings thay vì một expression gộp |
| `docs/verification/issue-595-group-05b.md` | Nguồn round 2, per-screen notes, deviation table, FAIL-before/PASS-after, checks và file map |

## Owner sim feedback 2026-11-12

Scope: PR #600, group 05B / 5.14, worktree `mobile-595`, base HEAD
`da79832e` (includes `origin/re-design` at `825f5224`). Owner's dated instruction
requests this focused UI correction. Results below apply to the uncommitted working
tree, not to a new commit or a simulator build. No staging, commit, push or Stitch write.

### Changes

- Visible schedule labels are now `Bắt đầu` / `Kết thúc` and `Start` / `End`.
  Both use `numberOfLines={1}` and the same `type.label.lineHeight` label box.
  Equal-width columns use `minWidth: 0` and `spacing[2]` between label and input.
  The optional hint (`Không bắt buộc` / `Optional`) sits below the end input, so
  wrapping cannot move that input down. Existing full accessibility labels remain.
- Sheet body uses `spacing[2]` after the header and `spacing[4]` between editors.
  Editor sections remove the old `spacing[4]` card padding/bottom margin using
  `spacing[0]`, and use `spacing[2]` for helper/field gaps. The name label/input
  group also uses `spacing[2]`. Shared SheetActions spacing and button styles remain.
- New layout styles live in `room-edit-sheet.style.tsx`; no existing style was moved
  or deleted. Input typography/colors remain in `room-manage.style.tsx`, with the
  same semantic Light/Dark tokens. No typography/ownership registry or pin needs
  relocation. Save handlers, payloads, validation, pending guards and stale warning
  remain unchanged.

### FAIL on da79832 / PASS after

Regression filter:
`pnpm test:ui --runInBand room-schedule-editor --testNamePattern='595 owner sim layout'`.

All six changed production files were temporarily loaded verbatim from
`git show da79832:<path>`, then restored byte-for-byte in `finally`; the new specs
were identical on both runs. HEAD/index were not changed.

| Regression | Original production @da79832 | Final working tree |
| --- | --- | --- |
| Single-line labels, equal label height, same column gap; optional hint after the input; compact rendered section spacing (vi/en × Light/Dark) | FAIL: 4 tests; short end label absent | PASS: 4 tests, included in room UI gate |
| Section/field token spacing without card insets | FAIL: 1 test; compact editorBody style absent | PASS: 1 test, included in room UI gate |

Baseline: `/tmp/595-owner-sim/fail-before.log` (5 failed / 28 skipped).
Final: `/tmp/595-owner-sim/ui-room.log` (all 33 schedule-editor tests included in
252 passing room tests). Initial four-case focused PASS also recorded in
`/tmp/595-owner-sim/pass-after.log`; final five-case evidence is the room gate.
Jest checks rendered props/layout structure, not native pixel geometry. A new 320pt
simulator check and visual Light/Dark acceptance were NOT RUN in this task.

### Checks

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/595-owner-sim/typecheck.log` |
| `pnpm test:ui room gogo-room --runInBand` | PASS, 17 suites / 252 tests | `/tmp/595-owner-sim/ui-room.log` |
| `pnpm test:ui --runInBand confirm-dialogs` | PASS, 1 suite / 73 tests; combined editor separate saves, validation and pending guards | `/tmp/595-owner-sim/combined-sheet.log` |
| `pnpm exec eslint` with all seven touched TS/TSX files | PASS, exit 0, no diagnostics | `/tmp/595-owner-sim/lint.log` |
| `pnpm test src/shared/ui/__tests__/type-scale.test.ts src/shared/ui/__tests__/submit-overlay.test.ts` | PASS, 2 files / 48 tests | `/tmp/595-owner-sim/guards.log` |
| `git diff --check` | PASS | No whitespace errors |

## Owner sim feedback 2026-11-12 (2)

Scope: PR #600, screens 5.10 / 5.11 / 5.12, worktree `mobile-595`, base
`67945034`. Owner decision: `dev/policy/decisions-log.md:5` in the workspace.
This dated instruction supersedes the older inline-couple/guest layout note above.
Uncommitted source review basis: **`rs-e3143bf5adf4`**, scope `src`, manifest and
retrievable patch at
`/tmp/595-owner-sim-2/snapshots/mobile-595-owner-sim-2-rs-e3143bf5adf4/MANIFEST.txt`.
Documentation is outside that source snapshot. No staging, commit, push or Stitch write.

### Changes

- Removed the standalone `Quản lý phòng` ghost button for couple and group hosts.
  Host access through `Sửa` on `Điều kiện phòng` remains; guest/member permissions
  and matching capabilities remain unchanged.
- All loaded lobbies now use the same floating `GlassBar` outside the ScrollView,
  with a measured bottom content inset. The existing quorum notice sits directly
  after the preferences CTA as `caption` / `text.secondary`, with the shared
  token gap and no paragraph margins. Start/partial-match/error states remain.
- Removed both no-app claims and their vi/en catalog keys. Removed the header
  invite action; the invite section retains one `Mời người tham gia` button using
  the existing verified native link-share flow, routing hold, clipboard fallback
  and `gogo_invite_shared` event (`native_share`, actual room type).
- Opaque invite tokens stay in secure invite state and canonical `/r/<token>`
  links, never in the room-code display. The label, row and Copy button are hidden
  by default, including checking/offline/closed-room states. No API field or fake
  code was added. Exported `GoGoRoomScreenProps.roomCode?: string | null` is the
  integration point for #649 / BE#861; only exactly six ASCII digits render.
  Leading zeroes survive. That future Copy control copies the six digits after
  invite verification; the invite button always shares the opaque-token LINK.
- Styles stay in `gogo-room.style.tsx`; shared Light/Dark semantic tokens and
  existing vi/en keys provide all remaining copy. Added exact view/style color
  binding pins to `stitch-color-pins.json`. The i18n computed-key registry and
  header ownership inventory retain their existing entries and pass their guards;
  no type-scale/token values or ownership entries needed changing.

### FAIL on 6794503 / PASS after

Identical regression specs and command on both runs:

`pnpm test:ui --runInBand room-state-matrix room-invite-reopen --testNamePattern='595 owner sim'`

The four changed production files (view, style, vi and en) were temporarily loaded
verbatim from `git show 6794503:<path>` and restored byte-for-byte in `finally`.
HEAD/index were not changed. SHA-256 restoration evidence and exit codes:
`/tmp/595-owner-sim-2/regression.json`.

| Regression | Production @6794503 | Working tree |
| --- | --- | --- |
| Shared fixed couple/guest action section | FAIL: CTA remains inside scroll content | PASS: CTA inside the fixed bar |
| Host controls / header / no-app claims, couple and group including guest, Light/Dark | FAIL: manage controls or no-app claim remain | PASS: removed; host `Sửa` still navigates; guest has no edit |
| Couple/group quorum hint, Light/Dark | FAIL: couple CTA inline; group hint uses body typography | PASS: caption with theme secondary color, same action parent, measured inset and preference route |
| Couple/group invite, Light/Dark | FAIL: 22-character token displayed | PASS: no token/code label/Copy, exactly one invite button, canonical LINK shared with analytics |

Baseline: **16 failed / 81 skipped**, exit 1, `/tmp/595-owner-sim-2/fail-before.log`.
After: **16 passed / 81 skipped**, exit 0, `/tmp/595-owner-sim-2/pass-after.log`.
The room gate also covers invalid/absent code props, leading-zero six-digit copy,
revocation verification, cold start, offline, reissue and private storage. These
replace old assertions that required the opaque token to be visible.

### Checks

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/595-owner-sim-2/typecheck.log` |
| `pnpm test:ui room gogo-room --runInBand` | PASS, 17 suites / 274 tests | `/tmp/595-owner-sim-2/ui-room.log` |
| `pnpm exec eslint` for all six touched TS/TSX files | PASS, exit 0, no diagnostics | `/tmp/595-owner-sim-2/lint.log` |
| `pnpm test` with type-scale, color-roles, app-header-ownership and submit-overlay files | PASS, 4 files / 112 tests | `/tmp/595-owner-sim-2/guards.log` |
| `pnpm test:ui --runInBand i18n-keys button-parent-geometry` | PASS, 2 suites / 50 tests | `/tmp/595-owner-sim-2/registry.log` |
| `git diff --check` | PASS | No whitespace errors |

Native simulator recheck / pixel acceptance: NOT RUN. Jest verifies rendered
structure, typography/color props and navigation/share behavior; native Share is
mocked. This report does not claim new simulator or 100% Stitch acceptance.

## Owner sim feedback 2026-11-12 (3)

Phạm vi: PR #600, màn 5.13, bắt đầu từ HEAD `06ac6f89` trên nhánh
`feature/GOGO-595-redesign-g05b-room`; working tree ban đầu sạch. Căn cứ:
owner instruction vòng này và `dev/policy/decisions-log.md`, mục #600 ngày 2026-11-12.
Không stage, commit, push hoặc sửa Stitch.

### Thay đổi và contract

- Seed dùng nguyên `PlaceCardSmall` với `onRemove` / `removeAccessibilityLabel`:
  nút X chung ở góc trên bên phải gọi mutation xoá seed hiện hành. Adapter chỉ
  truyền `placeId` và `name` có thật; không dựng ảnh/địa chỉ/giá/rating chưa có.
- Nút thêm là `IconBtn` dấu + ở bên phải tiêu đề `Địa điểm gợi ý`, nhãn trợ năng
  `Thêm địa điểm gợi ý`, kích thước thật `touchTarget.min` (44×44).
  Vẫn mở `/places/search` với `picker=1` và `roomId`; `pickerScope` là UUID trỏ
  vào snapshot trong bộ nhớ từ store #598. Snapshot lấy khu vực của phòng,
  không lấy discovery state toàn app; URL không chứa mã khu vực/toạ độ.
  Chặn mở lặp đến khi màn được focus lại; cleanup scope khi rời màn/picker.
- Phòng thiếu khu vực hoặc khu vực `needs_reselection` không mở tìm kiếm
  không giới hạn: disable + và hiện hướng dẫn chọn khu vực của phòng.
  `RoomSummary` không trả origin coordinates (chủ đích privacy của contract);
  không dựng toạ độ hoặc dùng vị trí toàn app làm thay thế.
- Tiêu đề section dùng `discoveryHeading` (17/22, cùng scale với `title2`),
  nhãn điều kiện dùng `caption` / `text.secondary`, giá trị dùng `body`.
  Warning/permission heading dùng `body`; nhãn budget trong editor dùng caption.
  Không đổi giá trị typography/color token; layout mới dùng spacing/touch tokens.
- Khu vực có `Sửa`, mở `AdministrativePicker` thật ở chế độ embedded trong
  `RoomEditSheet`. Danh sách tỉnh/xã tự scroll trong sheet full-height với
  chuỗi parent `flex: 1`; giữ nguyên container để không remount/mất lựa chọn.
  Huỷ bỏ draft, không gọi API. Save chỉ khả dụng khi khu vực hợp lệ và thay đổi,
  hoặc khu vực cũ cần chọn lại. Dataset đổi sẽ khoá Save đến khi chọn lại.
- **Không có contract gap:** `RoomConstraintPatch.administrativeArea` trong
  `openapi/gogo.v1.yaml` và generated schema nhận dataset/province/commune codes.
  Save gọi `useUpdateRoomConstraints` hiện hành, gửi riêng codes, giữ budget
  đã lưu/currency, kèm `expectedConstraintVersion`; không gửi labels/status/GPS.
  Dùng chung stale warning, success notice, conflict 409 và lỗi validation với
  budget. Mutation pending chặn submit/đóng sheet bằng overlay bên trong modal.
  Hook thật cập nhật room cache và invalidate suggestions/current plan/list.
  Manage vẫn host-only; member/guest không có editor, xem điều kiện qua lobby.
- Pins/registry: thêm view/style bindings của manage vào `stitch-color-pins.json`,
  thêm hàng + vào parent-geometry inventory, xác nhận cả budget/area có overlay.
  Registry i18n/header/type scale giữ nguyên và qua guard. Mock router của
  `confirm-dialogs` bổ sung focus hook; không thay kỳ vọng budget/name/schedule.

### FAIL trước / PASS sau

Command giống nhau: `pnpm test:ui --runInBand room-manage-feedback`.
Tạm nạp đúng sáu production files từ `git show HEAD:<path>`, chạy cùng specs,
khôi phục byte-for-byte trong `finally`, rồi chạy lại trên patch.
HEAD/index không đổi; SHA-256 và exit codes ở `/tmp/595-owner-sim-3/regression.json`.

| Bằng chứng | Trước @06ac6f89 | Sau patch |
| --- | --- | --- |
| Shared X, + icon/44pt/title placement/opaque scope/cleanup, typography Light/Dark | FAIL | PASS |
| Khu vực bắt buộc cho seed search, host save qua hook/API, stale invalidation, cancel, dataset validation, pending/409/400 | FAIL | PASS |
| Member/guest không có editor | PASS | PASS |
| Tổng | **14 failed / 2 passed**, exit 1 | **16 passed**, exit 0 |

Logs: `/tmp/595-owner-sim-3/fail-before.log`, `pass-after.log`.
Picker component và mutation hook là thật; query dataset và endpoint là test
boundaries. Không phải bằng chứng API DEV, server authorization hoặc simulator.

### Checks

| Command | Kết quả | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `/tmp/595-owner-sim-3/typecheck.log` |
| `pnpm test:ui room gogo-room --runInBand` | PASS, 18 suites / 290 tests | `/tmp/595-owner-sim-3/ui-room.log` |
| `pnpm test:ui --runInBand confirm-dialogs i18n-keys button-parent-geometry` | PASS, 3 suites / 124 tests | `/tmp/595-owner-sim-3/affected.log` |
| `pnpm test` với bốn path type-scale, color-roles, app-header-ownership, submit-overlay (không thêm `--`) | PASS, 4 files / 112 tests | `/tmp/595-owner-sim-3/guards.log` |
| `pnpm exec eslint` mọi TS/TSX đã chạm | PASS, không diagnostics | `/tmp/595-owner-sim-3/lint.log` |
| `git diff --check` | PASS | Không whitespace errors |

Một lần gọi nhầm `pnpm test -- <paths>` đã mở rộng thành full Vitest; dừng bằng
Ctrl-C sau khi thấy ba lỗi process/liveness sandbox trong `distribute-wrapper.test.ts`
(owner alive, recorded build process group alive, lock/run files after child exit),
cùng nhóm hạn chế đã ghi ở round trước. Không coi full Vitest là PASS; không sửa
hoặc skip các test đó. Lệnh scoped đúng phía trên chạy xong và PASS.

Chưa chạy simulator/build hoặc nghiệm thu native Light/Dark/pixel cho vòng này.
Các kết quả trên chỉ xác nhận code, rendered structure, contract binding và regressions.
