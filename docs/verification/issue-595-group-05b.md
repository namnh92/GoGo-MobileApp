# GoGo-MobileApp #595 — nhóm 05B

Ngày: 2026-11-10. Phạm vi: UI-only, không commit, không push.
Trạng thái: **chưa nghiệm thu 100% Stitch**. Đã sửa UI và bổ sung regression/state matrix;
chưa có ảnh app Light/Dark cạnh Stitch vì CoreSimulatorService không truy cập được trong sandbox.
Các điểm thiếu và chỗ cần owner quyết ở bảng bên dưới không được hiểu là đã được duyệt.

## Nguồn và revision

- Issue được đọc qua GitHub connector: <https://github.com/namnh92/GoGo-MobileApp/issues/595>.
  `gh issue view 595 --repo namnh92/GoGo-MobileApp` thất bại kết nối `api.github.com`.
- Nhánh: `feature/GOGO-595-redesign-g05b-room`.
- HEAD thực tế khi kiểm tra: `c87ed82f84a1400bc68fa5c58304e1883dbc9f59`.
  `c48d501` là ancestor; HEAD còn chứa shared refresh #590 và logo #587. Không reset/rebase.
- Đã đọc `RTK.md` tại `~/.claude/RTK.md`, các rule `core`, `git`, `stitch-design`,
  `design-system`, `quality-gates`, `execution-policy`, cùng skill UI/Mobile/QA của workspace.
- Đã dùng Stitch MCP `list_screens`, `get_screen`, `download_file` để đọc HTML **và ảnh** cả 5 màn.
  Không ghi/sửa project Stitch. Inventory không có Dark cùng tên; Dark dùng AppToken Light/Dark chung
  theo chỉ dẫn owner 2026-11-10. Không tự tạo bản Dark giả để chạy `parity.py`.
- `parity.py` trên cặp HTML Stitch: **NOT RUN**, không có cặp HTML Dark trong project cho 5 tên này.
  Test render hai theme scope chỉ chứng minh nội dung/quyền/trạng thái; không thay thế native visual parity.

## Đối chiếu từng màn

| Màn | Stitch | Light — phần đã dựng | Dark | Kết quả ảnh cạnh nhau |
| --- | --- | --- | --- | --- |
| 5.10 Phòng hẹn đôi | `10287728079123409484`, 780×2590 | Hero có badge couple, mã thật/copy/share theo capability, điều kiện theo thứ tự khu vực → lịch → ngân sách, roster thật, sở thích trước start. Không dựng người chưa tham gia. | Cùng component, màu theo theme semantic. | BLOCKED; chưa xác nhận 100%. |
| 5.11 Phòng chờ nhóm | `14565909522755492896`, 780×2058 | Header mời nhóm; bỏ hero hai avatar; điều kiện có nhãn; các member là hàng riêng, badge role/status, số N và progress thật. Edit dùng route manage sẵn có. | Cùng component và AppToken. | BLOCKED; chưa xác nhận 100%. |
| 5.12 Phòng chờ nhóm (Khách) | `18430637797999520424`, 780×2212 | Hero chung; điều kiện readonly; roster, trạng thái chờ host và chọn sở thích. Không lộ mã/share/start/edit host-only. | Cùng component và AppToken. | BLOCKED; chưa xác nhận 100%. |
| 5.13 Quản lý phòng | `2792671546852313500`, 780×3396 | Cảnh báo stale đầu màn; điều kiện dạng hàng mở sheet; seed dùng PlaceCardSmall; member/remove và confirmations giữ nguyên; metadata lời mời/revoke; thẻ quyền host và vùng nguy hiểm. | Cùng component và AppToken. | BLOCKED; chưa xác nhận 100%. |
| 5.14 Chỉnh sửa phòng hẹn | `10863076915262487091`, 780×1768 | Shared Sheet/AppHeader, input tên và editor lịch hiện hành; action Huỷ trái/Lưu phải qua SheetActions. Editor tên/lịch mở riêng để giữ từng validation/mutation, chưa phải combined editor như HTML. | Cùng component và AppToken. | BLOCKED; phần lịch của chính ảnh Stitch còn thiếu. |

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
| Một editor lưu đồng thời tên và lịch | 5.14 | App hiện có hai form/mutation độc lập. Bản vá giữ hai editor riêng; đây là **phần chưa khớp**, không coi là đã được duyệt. | Cần chốt UX lưu một phần/thất bại một phần trước khi ghép. Nếu cần atomic: draft GoGo-BE “Atomic title + schedule patch với constraintVersion, giữ endAt:null và stale; validation toàn bộ trước write; conflict không ghi một phần.” Không mở issue. |
| Trang 10/cursor/load-more cho member/seed/invite | 5.10–5.13 | Summary chứa roster/seed đầy đủ, invites không có cursor. Không đổi API/data model. | Đã thêm PullToRefresh dùng refetch hiện hành; vẫn render đủ N. Draft GoGo-BE: “Cursor pagination limit=10 cho room members/seed/invites; total/progress toàn phòng tách khỏi số dòng đã tải; đảm bảo quyền host/member/guest và realtime reconciliation.” Không mở issue. |

Không có dữ liệu thật ở khu vực/lịch/ngân sách lobby thì ẩn dòng. Giá luôn giữ unit từ budgetMode;
không đổi số tiền/divisor, không dùng “cả hai” cho nhóm. Không thêm dữ liệu sample của Stitch.

## Hành vi và test

- Không sửa shared API/auth/router/business model; các mutation payload, capability, alert/dialog confirmation,
  realtime, start matching, routing hold và invite verification giữ nguyên.
- UI bổ sung PullToRefresh trên lobby/manage, skeleton manage và offline state khi query chưa có dữ liệu.
- Ma trận lobby/manage render couple | group-host | group-guest × default | loading | empty | error
  trong cả hai ThemeScope. Guest default/empty manage render permission-denied thay cho host controls.
- Editor tên/lịch có ma trận audience × default | mutation-loading | empty field | mutation-error;
  audience không được sửa luôn readonly và không gửi mutation. Có regression trim/null/max80,
  end-before-start, explicit endAt:null, version, unit, partial-matching capability và confirmations.
- ThemeScope trong Jest giữ context màu/text nhưng native ScopedTheme được mock: không phải bằng chứng
  về pixel/layout/native accessibility. Target/selected state dựa vào shared Button/Chip/Sheet.

## Kiểm tra

| Command | Kết quả | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | `/tmp/595-typecheck.log` |
| `pnpm lint` | PASS, exit 0 | `/tmp/595-lint-final.log` |
| `pnpm test` | FAIL, exit 1: 144 files PASS; 1 skipped; 1 failed. 1743 tests PASS, 39 skipped, 3 failed. | `/tmp/595-test-final.log` |
| `pnpm test:ui --runInBand` | PASS, exit 0: 232 suites, 3425 tests, 11 snapshots. | `/tmp/595-ui-final.log` |
| `git diff --check` | PASS | Không có whitespace errors. |

Ba lỗi Vitest đều ở `src/shared/config/__tests__/distribute-wrapper.test.ts`:
`refuses while the owner is alive`, `refuses recovery while a recorded build process group is still alive`,
`keeps the lock and run files when a recorded build group is still alive after the child exits`.
Đây là nhóm process/liveness trong sandbox mà task giao Claude chạy lại bên ngoài; chưa coi Vitest toàn bộ xanh.
Không sửa wrapper/test wrapper hoặc bypass sandbox để đổi kết quả.
Ảnh app: BLOCKED (`xcrun simctl list devices booted`: CoreSimulatorService connection invalid,
Operation not permitted, không khởi tạo được device set). Không đổi permission mode, không bypass sandbox.
Không thể ghi workspace handoff map ngoài writable root; báo cáo này là artifact trong worktree #595.


## Files:dòng đã đổi

Các khoảng dưới đây là vị trí trong working tree cuối, gồm cả file mới. Diff thực tế là nguồn khi review.

| File | Dòng thay đổi chính |
| --- | --- |
| `src/features/gogo-room/gogo-room.view.tsx` | 2, 43–47, 82–111, 518, 532–540, 577–602, 620–671, 706–720, 761 |
| `src/features/gogo-room/gogo-room.style.tsx` | 6–11, 85; xóa style hero avatar/progress không còn dùng |
| `src/features/gogo-room/room-manage.view.tsx` | 12, 23–51, 76, 161–227, 285, 304–309, 327 |
| `src/features/gogo-room/room-manage.style.tsx` | 6–12 |
| `src/features/gogo-room/room-edit-sheet.view.tsx` | 1–24, mới |
| `src/features/gogo-room/room-edit-sheet.style.tsx` | 1–7, mới |
| `src/features/gogo-room/room-title-editor.view.tsx` | 11–13, 27, 88–96 |
| `src/features/gogo-room/room-schedule-editor.view.tsx` | 6–13, 37, 92–134 |
| `src/shared/i18n/vi.ts` | 768–777 |
| `src/shared/i18n/en.ts` | 787–796 |
| `src/features/__tests__/room-state-matrix.spec.tsx` | 1, 18–20, 78, 113, 139–142, 298–324 |
| `src/features/__tests__/confirm-dialogs.spec.tsx` | 1–5, 14–21, 44–47, 59, 114–160 |
| `src/features/__tests__/room-title-editor.spec.tsx` | 3–9, 25, 69–88 |
| `src/features/__tests__/room-schedule-editor.spec.tsx` | 2–7, 12, 59–77 |
| `src/features/__tests__/room-schedule-chip.spec.tsx` | 101, 104–105 |
| `src/features/__tests__/room-lobby-plus.spec.tsx` | 42–46; bỏ regression của hero avatar cũ |
| `docs/verification/issue-595-group-05b.md` | File mới: nguồn, đối chiếu 5 màn, bảng lệch, kết quả gate và danh mục file |
