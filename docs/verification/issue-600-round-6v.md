# #600 round 6v — wizard và editor dùng chung budget sheet

Owner brief 2026-11-12; base `2f0b4af114810ab26c7ed05dfe437da422d7b468`.
Không commit, stash, push, merge hoặc deploy.

## Kết quả

- Couple và group cùng 4 bước: `type → time → budget → places`. Group setup
  chuyển vào budget theo thứ tự count → mode → amount. Xoá screen/style cũ;
  `/create/group-setup` giữ thin route tới compatibility redirect `/create/budget`.
  Native cold/warm link, saved draft v1/v2 và restored back stack normalize
  `group-setup` thành budget. SCREEN_TEMPLATES bỏ tên screen đã nghỉ; chrome
  hiển thị budget là “Bước 3 / 4”. Không có analytics step name riêng còn sót.
- Mỗi step view import/render trực tiếp một `WizardStepHeader`: title display,
  subtitle body/text.secondary. Header sở hữu offset 24pt sau progress bar,
  title → subtitle 8pt, subtitle → content 24pt. Offset được chuyển từ chrome
  vào header để chỉ một nơi cấu hình. Không còn title/subtitle font ở style step.
- Một `SectionLabel` trong shared/ui dùng cho count/mode/amount, duration và
  selected places. `GroupBudgetFields` dùng chung ở wizard và editor; giới hạn
  count giữ 3–12. Hai mode dùng cùng `BudgetOptionCard` như các tier ngân sách.
- `RoomBudgetField` chuyển từ gogo-room sang shared/ui: wizard và editor cùng
  summary card có chevron → một Sheet chứa tier cards và custom input. Group
  count/mode nằm inline ở cả hai màn; title unit và description count cập nhật
  ngay, không tự đổi số tiền khi đổi cách tính.
- New draft không tự chọn 800k: hiện “Chọn ngân sách” + secondary description;
  Tiếp tục disabled đến khi có số tiền hợp lệ. Sheet stage cục bộ; Huỷ/dismiss
  bỏ thay đổi và lỗi. Xác nhận disabled khi invalid. Custom giữ integer VND,
  bounds 10.000–100.000.000, invalid-paste/error announcements và pristine
  custom selection (F-13/F-16/F-17). Chỉ editor cho giữ amount server cũ ngoài
  bounds khi không đổi; wizard và final submit vẫn enforce bounds.
- Header group dùng key riêng `createBudget.title_group`: “Ngân sách cho nhóm
  bạn?”; một subtitle `createBudget.body_group`: “Chọn số người dự kiến, cách
  tính và ngân sách cho cả nhóm.” Trước đó group budget lấy nhãn section/mode
  làm header, nên không giữ “Tính ngân sách theo” làm title lặp với section.
  Có bản tiếng Anh tương ứng; copy vẫn ở mỗi step.
- Places chỉ còn shared header, + Thêm địa điểm, Đã chọn (N) khi N > 0 và
  Tạo GoGo Room (cùng scope/limit/create error cần thiết). Đã xoá recommendation
  query, pagination, refresh, loading/empty/error states, i18n và specs liên quan.
  Picker đầy đủ giữ canonical area/GPS radius, nhận thêm derived
  `priceMaxPerPerson` làm initial filter qua opaque session; total chia số người
  và làm tròn xuống, couple luôn tổng cho 2. Không mang filter sang search thường.
- Selected list chừa top/right 12pt cho X offset −12pt; cùng gutter ngoài 16pt,
  cạnh phải X nằm đúng 16pt trong màn hình và card thu hẹp tương ứng.
- Fixture colour bindings cập nhật theo header di chuyển/xoá và các binding
  thực tế 6u còn chưa được ghi (PlaceCardSmall, room-members, room-seeds).
  Không đổi palette hay nới assertion semantic roles.

## Kiểm chứng

Review snapshot của toàn bộ thay đổi `src`: `rs-b028ef2b2985`.
Manifest, binary diff và untracked files:
`/tmp/mobile-600-6v-snapshots/mobile-600-6v-final-rs-b028ef2b2985/`.

- FAIL-before: guard Vitest mới chạy trên source HEAD 6u được export riêng vào
  `/tmp/mobile-600-6v-before`; 8 fail / 3 pass, đúng ở thiếu ownership mới,
  header offset/body, section labels, group merge và recommendation retirement.
- Guard sau sửa: 11/11 pass (cũng được chạy trong full Vitest).
- Header comparison: 8 render cases (4 step × couple/group) xác nhận cùng
  display/body, offset/gaps; riêng group-setup không còn là step độc lập.
- UI regression: placeholder → sheet → staged tier → confirm → Continue;
  custom bounds/paste, Huỷ giữ draft, reopen bỏ invalid state; live group count/
  mode; editor stale/PATCH/unchanged-budget rules; legacy redirects/resume;
  picker price/scope isolation; selected X gutter/cap/remove.
- Typecheck: PASS.
- Lint: PASS, 0 errors; 4 warning có sẵn ở assistant-keyboard-offset và
  assistant-usage-footer specs.
- Full Vitest `pnpm test`: **FAIL do môi trường** — 156 suites pass, 1 fail,
  1 skipped; 1.868 tests pass, 3 fail, 39 skipped. Ba failure chỉ ở
  `src/shared/config/__tests__/distribute-wrapper.test.ts`: owner-alive lock,
  stale lock còn build process group, child-exit còn build group. Sandbox chặn
  thực thi `/bin/ps` (`PermissionError: [Errno 1] Operation not permitted`);
  suite không đọc được process start/liveness. Không sửa wrapper hay stub `ps`
  để biến kết quả thành pass. Mọi Vitest còn lại, gồm ownership, palette,
  saved draft và budget domain, pass.
- Touched Jest: PASS — 19 suites, 532 tests. Lượt cuối gồm toàn bộ create-date,
  create-room-name, prefill-budget, room-edit-screen/regressions, i18n keys,
  shared Chip và screen-tag.
- Full `pnpm test:ui --runInBand`: PASS — 269 suites, 4.370 tests,
  11 snapshots; 175,094 giây. Lượt đầu bắt được hai assertion screen-tag cũ
  vẫn tính group-setup là screen; đã cập nhật redirect exclusion tương tự
  manage, thêm assertion route cũ không được tag, rồi chạy lại toàn bộ.
- `git diff --check`: PASS. Snapshot verify sau checks: MATCH
  `rs-b028ef2b2985`.

Chưa build/chạy simulator để nghiệm thu native rendering; các đo geometry
trên là render/style regression tests, không phải kết quả nhìn trên thiết bị.

Logs `/tmp/mobile-600-6v-*`: `before.log`, `guard.log`, `touched-final-pass.log`,
`picker-final.log`, `screen-tag-final.log`, `full-ui-final.log`, `full-unit-final.log`, `typecheck-final.log`,
`lint-final.log`, `sandbox-ps.log`.
