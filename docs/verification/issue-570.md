# GoGo-MobileApp #570 — hồ sơ đóng góp chờ duyệt

Ngày: 2026-11-13. Worktree `dev/worktrees/mobile-570`, nhánh
`feature/GOGO-570-pending-contribution-detail`; base `0ec27a61`.
Sol thực hiện theo lệnh owner; không stage, commit, push hoặc cài package.

## Phạm vi và route

- Route mới: `/me/contributions/[submissionId]`; file route chỉ re-export view.
- Chuyển route danh sách thành `src/app/me/contributions/index.tsx` để danh sách
  trở thành index của nhánh route. URL `/me/contributions` không đổi.
- Pending mở hồ sơ riêng bằng submission ID; rejected chỉ mở khi deadline còn hạn.
  Approved/merged giữ route canonical `/places/[placeId]`.
- Dùng hook/client GET detail hiện có, chỉ mở truy vấn khi đã đăng nhập và có ID.
  Hook nhận ID và optional updatedAt, không dựng một submission giả cho route.
- Đăng ký template route mới trong allowlist Sentry; không đưa ID thật vào tag.
- Card danh sách giữ cover đã lưu và Google rating; bổ sung hours qua component
  dùng chung. Không thêm save/share/booking/review/tab bar.

## Nguồn thiết kế và sai khác

Đã đọc bằng Stitch `get_screen` và `download_file` (HTML), project
`17315762413421369447`, S80 `560f5d68197345a29926106cfce6c3b4`, tên
“Chi tiết địa điểm · Đang chờ duyệt - GoGo”. Dark dùng các role của AppToken.

| Thành phần | Triển khai | Lý do |
| --- | --- | --- |
| Badge ưu tiên 24h | Bỏ | Quyết định owner 2026-11-13 |
| Experience | Hai hàng Phục vụ/Không gian ★n/5; chip CMS; món/mẹo dạng trích dẫn | Quyết định owner; ẩn từng hàng thiếu dữ liệu |
| Khoảng cách Hồ Hoàn Kiếm | Bỏ | Không có trường dữ liệu |
| Địa chỉ đầy đủ | Hiện `addressShort` sẵn có | Detail/provider snapshot không có trường full address; không dựng địa chỉ |
| Reward +50 mẫu | Ẩn | `AssistantStatus` hiện chỉ có creditBalance/reserved/available, không có số thưởng contribution; balance không phải award. Không hardcode 50, không thêm field contract. Không thể kiểm thử trạng thái “award đã biết” với contract hiện tại |
| Hero header | Thêm variant `hero` vào `AppHeader`, pill và dot tĩnh | Giữ shared header ownership, ≥44pt; không pulse khi cần reduced motion |
| Hero credit | Shared `ContributionCredits` một dòng trên scrim, tác giả và nguồn từ cover | Một nguồn cho ảnh, không lấy attribution từ ảnh provider khác |
| Vibe/footer copy | Sentence case; đặt tên trang trong dấu ngoặc kép | Cổng i18n sentence-case; nội dung vẫn tiếng Việt |
| Amenity | Tối đa 5 giá trị true đã có nhãn CMS; Xem tất cả/Thu gọn | Không lộ key chưa có nhãn; không thêm taxonomy mẫu vào production |
| Provider deferred/budget exhausted | Ẩn rating/hours/Maps/provider attribution; giữ user input và `contributions.detailsPending` | Không trình bày facts không sẵn có |
| Canvas/colour/type | Shared Card/Text/Button/Chip, semantic theme roles | Dark theo theme, không hex/rgba hay fontSize riêng |

## Test và bằng chứng FAIL-before / PASS-after

Test navigation mới ở `src/features/__tests__/my-contributions.spec.tsx`:
`opens pending submissions in the private detail route` và
`opens rejected submissions only before the update deadline`.

Trước khi sửa production, chạy:

```sh
pnpm test:ui --runInBand src/features/__tests__/my-contributions.spec.tsx
```

Log `/tmp/issue-570-before.log`:

```text
26: ● opens pending submissions in the private detail route
28: Unable to find an element with role: button, name: Pending café
545: ● opens rejected submissions only before the update deadline
547: Unable to find an element with role: button, name: Editable
```

Đây là lỗi thật: card cũ không có onPress, nên không có button role. Lần đầu
cũng có hai assertion canonical dùng tên fixture sai (view đã hydrate thành
“Catalogue café”); sửa test để chọn tên thực tế, không sửa behavior canonical.
Tổng lần đầu: 4 failed, 13 passed. Hai regression private-route giữ nguyên.

Sau sửa navigation, cùng command: 17 passed, 1 suite passed
(`/tmp/issue-570-after-navigation.log`).

Test detail dùng chung cho Light và Dark:

- Pending banner/date, không badge 24h; Google rating/count/source và hours.
- Nhãn CMS, price+unit (kể cả free/per_group), purpose/vibe/amenity.
- Amenity chỉ true, 5 hàng rồi mở rộng; key chưa có nhãn bị ẩn.
- Phục vụ/Không gian, chip, món/mẹo trích dẫn; từng hàng rỗng/price unit lạ bị ẩn.
- No-photo placeholder, credit một dòng, ảnh lỗi không giữ credit.
- Rejected public reason/deadline, ảnh hết hạn bị ẩn, không promise credit.
- Deferred/budget exhausted giữ contribution, ẩn provider facts.
- Loading skeleton, offline, retry lỗi mạng, không retry 429, 404 và guest.
- Dark assertion warning/danger surface đúng theme.
- Back/Maps actions; không tab dock.

Command focused gồm detail Light/Dark, list navigation và route telemetry:

```sh
pnpm test:ui --runInBand src/features/__tests__/submission-detail.spec.tsx src/features/__tests__/submission-detail-dark.spec.tsx src/features/__tests__/my-contributions.spec.tsx src/shared/observability/__tests__/screen-tag.spec.tsx
```

Kết quả focused (trước khi thêm case cover/hours cuối): **137 passed / 4 suites**,
log `/tmp/issue-570-focused-final.log:7-16`. Sau case cover/hours:
`pnpm test:ui --runInBand src/features/__tests__/my-contributions.spec.tsx` →
**18 passed / 1 suite**, `/tmp/issue-570-card-final.log:21-31` (hai regression
private-route PASS ở dòng 21-22, canonical ở 23-24, cover/rating/hours ở 25).
Detail Light/Dark cùng enforcement sau khi tách stored-credit composition:
**57 passed / 3 suites**, `/tmp/issue-570-ownership-final.log`.

Hai test snapshot cũ yêu cầu không có hours được cập nhật để yêu cầu hours theo
issue #570; case thiếu giờ vẫn phải ẩn. Đã bổ sung detail vào danh sách media
owners (cùng loại entity với canonical place detail), không bỏ guard chống card
riêng. Truy cập `place-card` composition chỉ nằm trong shared UI.

31 feature test cases mới: 5 ở list, 13 case × Light/Dark ở detail; ngoài ra có
route-template/header/media-ownership guard và hai expectation hours được cập nhật.

## Cổng kiểm tra

| Command | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0; 4 warning `no-require-imports` có sẵn trong assistant-keyboard-offset và assistant-usage-footer |
| `pnpm test:ui --maxWorkers=2` | FAIL: 259 suites / 4013 tests passed; 1 suite / 1 test failed; 11 snapshots passed |
| `pnpm test` | FAIL do sandbox: 152 files passed, 1 failed, 1 skipped; 1812 tests passed, 3 failed, 39 skipped |
| `git diff --check` | PASS |

Jest full log `/tmp/issue-570-jest-complete.log:3357-3361`:

```text
Test Suites: 1 failed, 259 passed, 260 total
Tests:       1 failed, 4013 passed, 4014 total
Snapshots:   11 passed, 11 total
```

Failure duy nhất: `loading-indicator.spec.tsx`, case orangeDark
“waits for the OS, starts the loop, then cancels to a static mark when Reduce Motion changes”.
Console báo `VirtualizedList` cập nhật ngoài `act`. Suite/component này không có diff.
Chạy riêng để phân biệt failure không ổn định:

```sh
pnpm test:ui --runInBand src/shared/ui/__tests__/loading-indicator.spec.tsx
```

Kết quả **24 passed / 1 suite**, `/tmp/issue-570-loading-isolated.log`.
Không gọi full Jest là PASS chỉ vì isolated đã PASS. Mọi test issue #570,
header/media ownership, route telemetry, i18n và snapshot hours đều PASS trong
run full cuối. Không có thay đổi production để che warning test ngoài phạm vi.

Vitest full log `/tmp/issue-570-vitest-complete.log:52-55`. Ba failure đều ở
`src/shared/config/__tests__/distribute-wrapper.test.ts`: owner còn sống,
recovery khi process group còn sống, và giữ lock khi child group chưa thoát.
Test gọi `ps` (dòng 208) và kiểm tra process group; sandbox từ chối `ps` và
signal/process inspection. Cả test file và `scripts/distribute.sh` không có diff;
không sửa distribution để làm xanh test UI.

Run Jest full trước phát hiện guard cho route/header/media và hai expectation
“không có hours” đã lỗi thời; các vấn đề đã sửa và chạy lại focused. Một warning
`act` ở round-four GPS trong run tuần tự không lặp lại ở isolated run
(`pnpm test:ui --runInBand src/features/__tests__/i18n-keys.spec.tsx src/features/create-date/__tests__/round-four.spec.tsx`: 68 passed).
Không đưa warning này thành thay đổi production ngoài phạm vi.

Không chạy simulator/thiết bị: chưa xác nhận visual acceptance hay hình học thực
trên iPhone SE. Layout dùng ScrollView, tile wrap, credit co lại và safe-area;
không coi render test là bằng chứng device acceptance.

## File thay đổi

Route:
- `src/app/me/contributions.tsx` → `src/app/me/contributions/index.tsx`
- `src/app/me/contributions/[submissionId].tsx`

Feature:
- `src/features/contributions/my-contributions.view.tsx`
- `src/features/contributions/submission-detail.view.tsx`
- `src/features/contributions/submission-detail.style.tsx`

Shared:
- `src/shared/api/queries/use-my-place-submissions.ts`
- `src/shared/ui/app-header.view.tsx`, `src/shared/ui/app-header.style.tsx`
- `src/shared/ui/contribution-card.view.tsx`, `src/shared/ui/contribution-card.style.tsx`
- `src/shared/ui/contribution-place-card.view.tsx`
- `src/shared/ui/submission-facts.view.tsx`
- `src/shared/i18n/vi.ts`, `src/shared/i18n/en.ts` (key mới ở en dùng cùng bản vi theo phạm vi Vietnamese-only)
- `src/shared/observability/screen-templates.ts`

Tests:
- `src/features/__tests__/my-contributions.spec.tsx`
- `src/features/__tests__/my-contributions-snapshot.spec.tsx`
- `src/features/__tests__/my-contributions-dark.spec.tsx`
- `src/features/__tests__/submission-detail.cases.tsx`
- `src/features/__tests__/submission-detail.spec.tsx`
- `src/features/__tests__/submission-detail-dark.spec.tsx`
- `src/shared/ui/__tests__/app-header-ownership.test.ts`
- `src/shared/ui/__tests__/place-card-enforcement.spec.ts`
- `src/shared/observability/__tests__/screen-tag.spec.tsx`

Docs: `docs/verification/issue-570.md`.
