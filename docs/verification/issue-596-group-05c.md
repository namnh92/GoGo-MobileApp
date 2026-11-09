# GoGo-MobileApp #596 — nhóm 05C: Lời mời và vào phòng

Ngày: 2026-11-10 (Asia/Ho_Chi_Minh). Round 2 trên nhánh `feature/GOGO-596-redesign-g05c-invite`, HEAD `ab7d056` (round 1), base review `c87ed82`. Giữ nguyên HEAD/branch, không rebase/reset. Không commit, push, mở issue hay PR.

## Round 2 — Astra F-01 đến F-04

Nguồn: `dev/handoffs/codex-596.md` và `dev/handoffs/codex-review-request-596.sa.out` trong workspace gốc. Worktree sạch tại `ab7d056` trước lượt sửa này.

- **F-01:** preview anonymous không quyết định quyền re-entry của tài khoản. Với session `user`, preview 404/410 chỉ hiện thông báo + retry; CTA join cũ vẫn gọi server. Chỉ phản hồi join mới chuyển tài khoản sang terminal. Host/member nhận membership vẫn đi `/room/{roomId}`, không thay session khách và không đếm `alreadyMember: true` là join mới. Giữ endpoint và hành vi re-entry của base `c87ed82`.
- **F-02:** component xử lý invite được key theo `inviteCode`. Warm link A → B reset toàn bộ lỗi, pending, tên và confirmation của A. Cleanup đánh dấu attempt cũ không còn active; các kết quả join/guest-join muộn không set state, track hay điều hướng vào A. Preview tiếp tục dùng query identity opaque, abort và loại query cũ như round 1. Không thay session/auth implementation.
- **F-03:** render dialog thật trong terminal branch. Preview 404/410 tới sau khi mở confirmation không làm mất nút giữ/thay phiên; cả hai lựa chọn settle promise, chạy `finally` và reset pending. Xác nhận vẫn đi qua join server cũ; hủy không thay phiên. Khi đổi mã, unmount hook dialog cũ settle confirmation bằng cancel.
- **F-04:** suite preview giữ hook TanStack Query + Zod + API boundary thật, chỉ mock `api.post` của preview và kết quả join/session. Không stub `useInvitePreview` hay confirmation trong suite tích hợp. Typed-code cũng dùng dialog thật và kiểm tra nội dung lỗi.

### FAIL-before / PASS-after

Command cho cả hai lần: `pnpm test:ui --runInBand src/features/__tests__/invite-preview.spec.tsx -t 'F-01|F-02|F-03'`. Thêm regression trước, chạy trên source `ab7d056` chưa sửa, rồi chạy lại cùng tên test sau patch.

| Finding | Regression | FAIL-before @ ab7d056 | PASS-after @ working tree |
| --- | --- | --- | --- |
| F-01 | Couple / group-host / group-guest × preview 410 INVITE_NOT_USABLE / ROOM_NOT_JOINABLE / ROOM_EXPIRED; join trả membership `alreadyMember: true` | 9/9 FAIL: không có nút `Tham gia` sau preview 410 | 9/9 PASS: gọi join đúng mã, route membership, không guest join/analytics |
| F-02 | Join A trả 404 hoặc 410 (ba mã) → warm link B → preview B 200 | 4/4 FAIL: không tìm được inviter B (`Lan`), terminal A còn giữ | 4/4 PASS: inviter B hiện, lỗi A mất, CTA gọi join B và route B |
| F-03 | Guest bấm join lúc preview pending → dialog thật → preview 404/410 INVITE_NOT_USABLE/ROOM_EXPIRED → giữ hoặc thay phiên | 6/6 FAIL: dialog mất nút `Giữ phiên hiện tại` / `Thay và tham gia` | 6/6 PASS: chọn được cả hai nhánh; refetch cùng mã về 200 xác nhận pending đã reset |

Tổng regression: **19 FAIL trước → 19 PASS sau**. Log: `/tmp/596-round2-before.log`, `/tmp/596-round2-after.log`. Lần before có 105 test khác được skip; after có 108 test khác được skip do bổ sung thêm ba test delayed-result, không thay đổi 19 regression này.

Ngoài 19 ca: kiểm tra join A success/failure tới lúc B pending, guest-join A success/failure tới sau B, preview A success/failure muộn, đổi mã khi confirmation đang mở. Kết quả cũ không phá pending, copy hay navigation của B.

### Matrix tích hợp và N/A

Mỗi hàng preview chạy cho **couple (2 người), group-host (7), group-guest (4)** × session **user / anonymous / guest**. DTO preview không có actor role: chỉ join membership trả host/member; không gán quyền host hoặc badge chủ phòng từ preview.

| Screen/state | Coverage và content assertions | N/A có lý do |
| --- | --- | --- |
| 5.15 default | 18 ca: ba audience × ba session × budget `total` / `per_person`; inviter, email verified, type/count, thời gian, area, tiền VND + `/ nhóm` hoặc `/ người`, form tài khoản/tên khách và guest notice. English USD total có assertion riêng. Không tự join. | Host-only controls N/A: preview public không trả role hay quyền. |
| 5.15 loading | 9 ca: skeleton, title, CTA và không tự join. | Budget/room facts N/A khi response chưa tới; không dựng dữ liệu chờ. |
| 5.15 error | 63 ca: 400, 404, ba mã 410, 429, offline × ba audience × ba session; assert câu lỗi cụ thể. User 404/410 vẫn có join/retry; anonymous/guest đi terminal; 400/429/offline có retry. | Hai budget modes N/A trên error: error response không có facts/budget. |
| 5.18 expired | Anonymous/guest: 410 INVITE_NOT_USABLE hiện title, body, recovery, không join. Signed-in: join-rejected expired được kiểm tra cùng preview thật trong F-02. | Terminal chỉ do preview cho signed-in N/A: F-01 buộc server join xác nhận re-entry trước. Terminal loading/budget N/A: không có request/data riêng. |
| 5.19 unusable | 404 và 410 ROOM_NOT_JOINABLE/ROOM_EXPIRED có title/body, recovery; phòng đóng/hết hạn không khuyên xin link mới. Signed-in join rejection trong F-02. | Terminal chỉ do preview cho signed-in N/A như trên; terminal loading/budget N/A vì không có request/data riêng. |
| 5.16 typed-code default/loading/error | Suite hiện hữu kiểm tra paste/clear, tên, hydration, pending và chống bấm lặp. Bổ sung 18 ca 400/404/ba mã 410/429 × user/anonymous/guest: câu lỗi đúng, giữ nguyên mã, CTA dùng lại được, đi đúng join path, guest xác nhận thật. Offline có assertion riêng. | Audience/budget/preview N/A: màn nhập mã không gọi preview và không có dữ kiện phòng trước join. Expired/unusable giữ inline copy cũ, không chuyển 5.18/5.19. |

### Gate round 2

- `pnpm typecheck`: **PASS**, exit 0.
- `pnpm lint` và kiểm tra lại `pnpm lint --no-cache`: **PASS**, exit 0. Không sửa `scripts/generate-brand-icons.mjs`; cả hai lần không phát sinh hai no-undef nền được task cho phép. Logs `/tmp/596-round2-lint.log`, `/tmp/596-round2-lint-nocache.log`.
- Affected UI specs: **7 suites / 203 tests PASS**, exit 0 (`/tmp/596-round2-focused.log`). Bao gồm preview (127 ca), typed-code redesign, guest-join, guest-replace-confirm, join-tracks-real-join, join-by-code, redesign-missing-screens.
- `pnpm exec vitest run src/shared/api/__tests__/invite-preview.test.ts`: **10/10 PASS**, exit 0; thêm 400 vào boundary/error mapping (`/tmp/596-round2-api.log`).
- `pnpm test -- src/shared/api/__tests__/invite-preview.test.ts`: Vitest chạy **toàn bộ** suite vì dấu `--`; **145 files PASS, 1 FAIL, 1 SKIP; 1.753 tests PASS, 3 FAIL, 39 SKIP**, exit 1. Chỉ ba failure `distribute-wrapper.test.ts` đã ghi round 1: owner alive, recorded process group alive, lock/run-files after child exit. Sandbox cấm `ps` (`operation not permitted`); cần chạy ngoài sandbox để chốt gate này. Không sửa scripts/tests distribute. Log `/tmp/596-round2-unit-focused.log`.
- `pnpm test:ui --runInBand`: **234 suites / 3.497 tests / 11 snapshots PASS**, exit 0, 159,912 giây. Bao gồm `notifications-g10.spec.tsx` từng lỗi timing ở round 1. Log `/tmp/596-round2-ui.log`.
- `git diff --check`: **PASS**.

Round 2 đọc lại bốn screenshot nguồn qua Stitch MCP và list project: không có Dark cùng tên. Không đổi layout/token/copy; sửa điều kiện hiển thị/action theo contract. Bảng lệch dưới đây tiếp tục áp dụng. **Visual acceptance vẫn incomplete, 0/4 màn có ảnh app đối chiếu cả Light/Dark**; không coi test render là native/pixel acceptance.

### Files:lines round 2

Các dòng dưới tính trên working tree round 2; danh sách round 1 phía cuối chỉ là lịch sử.

| File | Dòng và nội dung |
| --- | --- |
| `src/features/gogo-room/guest-join.view.tsx` | 39–59 key theo code + active lifetime; 116–158 chặn stale async results; 192–200 signed-in re-entry và dialog terminal |
| `src/features/__tests__/invite-preview.spec.tsx` | 23–36 bỏ stub dialog/reset fixtures; 101–338 integrated matrix, F-01/F-02/F-03 và delayed-result regressions |
| `src/features/__tests__/invite-code-redesign.spec.tsx` | 44–74 content matrix 400/404/410/429 × ba session, dialog thật |
| `src/shared/api/__tests__/invite-preview.test.ts` | 16 thêm preview 400 preservation |
| `docs/verification/issue-596-group-05c.md` | Round 2 evidence, matrix/N/A, gate và chỉnh deviation preview/re-entry |

## Nguồn và phạm vi

Đã đọc issue #596 qua GitHub connector (lệnh `gh issue view 596 --repo namnh92/GoGo-MobileApp` lỗi kết nối mạng). Đã đọc metadata, toàn bộ HTML và ảnh PNG của cả bốn màn qua Stitch MCP `get_screen` + `download_file`, và liệt kê toàn project `17315762413421369447` để tìm Dark. Không có màn Dark cùng tên. Quyết định owner 2026-11-10 cho nhóm 05 áp bộ AppToken Light/Dark chung; đây không phải lệch thiết kế.

Chỉ sửa cách trình bày và thêm read preview theo yêu cầu. Routes `/r/[inviteCode]` và `/join` giữ nguyên thin re-export. Không sửa schema sinh, session/auth/claim, deep links, navigation resolver, join endpoint, role hay data model. Luồng signed-in/guest, xác nhận thay phiên khách, validate tên, analytics chỉ khi join thực, và tránh điều hướng khi invite screen mất focus được giữ nguyên.

Preview: generated `OpBody<'previewRoomInvite'>` / `OpResponse<'previewRoomInvite'>`, client API có sẵn, Zod tại boundary, TanStack Query. POST body chứa mã, path cố định `/rooms/invites/preview`. Không mã trong query key, URL request, log hay analytics. Query dùng ID opaque riêng theo mount/link, không persist, `gcTime: 0`, không retry tự động, không tự refetch khi focus/reconnect, có abort signal. Đọc preview không gọi join. Preview lỗi mạng/429 có retry độc lập; join vẫn do người dùng bấm và dùng handler cũ.

## Đối chiếu từng màn

| Màn | Stitch Light | Light thực hiện | Dark thực hiện | Trạng thái bằng chứng |
| --- | --- | --- | --- | --- |
| 5.15 Lời mời tham gia | `14972595260953532404` | Chip → title → người mời → chi tiết → tên/CTA; dữ kiện từ preview; avatar cache memory-disk; chỉ email verified, không KYC; N người từ type + count; tiền minor units kèm /người hoặc /nhóm; ẩn dòng thiếu. Skeleton giữ chỗ cho preview, lỗi đọc có retry. | Cùng JSX/layout/copy, dùng role tokens AppToken. | Đã đọc ảnh/HTML nguồn; chưa có ảnh app cạnh Stitch. |
| 5.16 Vào phòng bằng mã | `4327819990303034231` | AppHeader; mô tả → card mã + Dán/Xoá → tên khách nếu cần → tip không tài khoản → CTA Vào phòng. Không giới hạn sáu ký tự, không đổi hoa/thường. Loading/disabled và lỗi join cũ giữ nguyên. | Cùng layout, card/input/text/status/accent dùng role tokens. | Đã đọc ảnh/HTML nguồn; chưa có ảnh app cạnh Stitch. |
| 5.18 Lời mời đã hết hạn | `9068423104561654909` | Minh hoạ đồng hồ, title, giải thích đúng nghĩa lỗi invite và hai recovery CTA cũ. Không thêm dữ liệu phòng mẫu hoặc nút tạo phòng không có handler. | Cùng layout, đồng hồ và surface/accent theo theme. | Đã đọc ảnh/HTML nguồn; chưa có ảnh app cạnh Stitch. |
| 5.19 Liên kết không còn dùng được | `10219812896993323843` | Card, minh hoạ đứt liên kết, title, hướng dẫn và hai recovery CTA. Với phòng đóng/hết hạn giữ nguyên thông báo rằng link mới không giúp được; ẩn gợi ý xin link mới. | Cùng layout, surface/text/status theo theme. | Đã đọc ảnh/HTML nguồn; chưa có ảnh app cạnh Stitch. |

**Chưa xác nhận khớp 100%:** 0/4 màn có ảnh app đặt cạnh Stitch ở cả hai theme. Test render không thay bằng chứng pixel/native. Không có build mới hay nghiệm thu DEV trong phiên này. Chưa chạy `parity.py` native/image comparison; không báo PASS dựa trên source inspection.

## Bảng lệch

| Stitch element | Screen | Reason | Proposal |
| --- | --- | --- | --- |
| “Ghép kèo tức thì”, câu Sài Gòn/tối nay/ấm cúng | 5.15 | Không có fact bảo đảm thời điểm/thành phố/mood hay ghép ngay. | Ẩn lời hứa và copy mẫu; mô tả người mời bằng i18n trung tính. Không cần BE cho lời hứa này. |
| Minh Anh, avatar mẫu, vai trò “Chủ phòng” | 5.15 | DTO có inviter, avatar nullable, emailVerified; không khẳng định inviter là chủ phòng hay KYC. | Dùng displayName/avatar thật; ẩn avatar thiếu; ghi “Người mời”, “Đã xác minh email” đúng fact. |
| Giờ/khu vực/ngân sách mẫu | 5.15 | Dữ liệu optional; budget API là một số tiền, không phải khoảng giá. | Ẩn từng fact thiếu; dùng số tiền API và unit theo mode, không suy diễn khoảng giá. Hiển thị N người từ roomType + participantCount. |
| Ảnh mood, gu không gian, “4 gợi ý chờ” | 5.15 | Không có nguồn trong preview/public pre-join contract. | Không dựng. BE issue đề xuất (chưa mở): “Bổ sung dữ kiện mood công khai cho invite preview nếu sản phẩm duyệt: mood keys, ảnh có nguồn, số gợi ý được phép công khai; không lộ danh sách thành viên/id/mã mời; optional, có test quyền và privacy.” |
| Avatar đôi và avatar tài khoản mẫu | 5.16 | Chưa biết phòng/người tham gia trước khi nhập mã; ảnh mẫu không phải người dùng thật. | Ẩn; không suy ra phòng cố định hai người. |
| “Ví dụ GOGO-8921”, mã không phân biệt hoa thường; gợi ý mã gần đây | 5.16 | Ví dụ/khẳng định không có nguồn contract; không có storage lịch sử mã. Mã hiện tại là credential opaque, cần giữ nguyên. | Không dựng mã mẫu/lịch sử; giữ input tự do và Dán, không lưu mã. Nếu cần lịch sử: owner quyết định privacy/storage trước, không tự triển khai. |
| “Kế hoạch lưu tức thì trên máy” | 5.16 | Chưa có kế hoạch ngay lúc join; câu hứa không được xác nhận. | Chỉ giữ fact không cần tài khoản. |
| “Đang diễn ra ở Sài Gòn”, 1.4k phòng, hai phòng/ảnh và số thành viên | 5.16 | Chưa có public API cung cấp các dữ kiện này. | Không dựng. BE issue đề xuất (chưa mở): “Nếu owner duyệt khám phá phòng công khai: endpoint aggregate theo khu vực, room visibility/consent, danh sách có cursor 10, ảnh có nguồn và aggregate participantCount; không trả mã invite/PII.” |
| Quét QR | 5.16 | Không có scanner handler/permission flow hiện hữu trong màn. | Không dựng; owner xác nhận phạm vi tính năng riêng trước. |
| “Hết lượt dùng”, room title/host/nhóm/giờ đóng mẫu | 5.18 | 410 không cung cấp phòng và nguyên nhân chi tiết; INVITE_NOT_USABLE cũng có thể revoked/expired. | Ẩn dữ kiện/nhãn suy diễn. BE issue đề xuất (chưa mở): “Nếu cần tóm tắt invite không còn dùng được, chốt privacy trước khi thêm optional public safe summary/reason vào error contract; không trả PII/member id.” |
| Tự lên kèo nhóm / Tạo ngay | 5.18 | Nút Stitch không có handler; thêm nhánh tạo phòng sẽ mở rộng navigation ngoài task. | Không dựng; owner quyết định nối flow tạo phòng ở task riêng. |
| Chẩn đoán / ERR_LINK_INVALID_SESSION, mã sáu số, footer Sài Gòn | 5.19 | Không phải mã lỗi contract, không có room length constraint/thành phố như hình. | Không dựng dữ liệu mẫu; hướng dẫn dùng mã thật không cố định độ dài. Không hiển thị error code bịa. |
| Drawer nhập mã riêng | 5.19 | Chưa có drawer chức năng trong flow hiện hữu; đã có route `/join`. | Giữ recovery route `/join` cũ; không thêm flow/drawer mới. |
| Mapping màn unusable cho 404 / ROOM_NOT_JOINABLE / ROOM_EXPIRED | 5.19 | Nhánh UI mới trong guest-join error handling; trước đây inline error. | Giữ nghĩa thông báo cũ và endpoint/handler join; room closed/expired không khuyên xin link mới. INVITE_NOT_USABLE/410 khác → 5.18. Round 2: signed-in preview lỗi chỉ informational, join mới quyết định terminal; dialog chờ xác nhận vẫn mounted. Typed-code giữ inline mapping cũ. |
| AppHeader, tên khách bắt buộc, thông báo thay phiên, spinner, token font/button/accent | Cả nhóm | Thành phần dùng chung và hành vi hiện hữu phải được giữ; Stitch không mô tả đầy đủ các trạng thái này. | Giữ shared AppHeader/Button/LoadingIndicator và token role; CTA một filled primary; không override pressed highlight. Guest form giữ max 50 và trim. |

## Kiểm tra round 1 — lịch sử trước Astra review

- `pnpm typecheck`: PASS, exit 0 (bản cuối).
- `pnpm lint`: PASS, exit 0, không warning (bản cuối).
- `pnpm test`: 145 file PASS, 1 file FAIL, 1 SKIP; 1.752 test PASS, 3 FAIL, 39 SKIP. Ba failure chỉ trong `distribute-wrapper.test.ts`: owner-alive, recorded-process-group-alive và lock/run-files-after-child-exit. Nhóm sandbox limitation đã được owner nêu; cần Claude chạy lại ngoài sandbox. Không sửa distribute scripts/tests.
- `pnpm test:ui --runInBand`: 233 suite PASS, 1 FAIL; 3.366 test PASS, 1 FAIL; 11 snapshot PASS. Failure tại `notifications-g10.spec.tsx`: `orangeDark inbox error regression > shows one stale notice for cached list + summary failures (0 rows)`, cảnh báo update VirtualizedList ngoài `act`. Không sửa notification code/test. Đây là kết quả full run trước lần chốt icon màu role và test hydration.
- Chạy riêng lại `notifications-g10.spec.tsx`: **193/193 PASS**, exit 0. Full-suite vẫn được ghi FAIL; lần chạy riêng cho thấy failure phụ thuộc timing, không đủ để đổi kết quả full run thành PASS.
- Chạy lại 7 suite liên quan sau thay đổi cuối: **74/74 PASS**, gồm guest join cũ, guest replacement, analytics new-membership, typed-code, recovery và preview.
- Preview API unit: 200, 404, ba mã 410, 429, malformed boundary và không gọi join; nằm trong full unit run.
- `git diff --check`: PASS. Routes vẫn đúng thin re-export. Không có invite credential trong query key hay persistence.
- Default/loading/error là trạng thái của hai màn form; expired/unusable là terminal UI, không có request riêng. Hai terminal state được render qua lỗi preview và join. Không bịa loading/API cho terminal state.

Log tạm: `/tmp/596-typecheck.log`, `/tmp/596-lint.log`, `/tmp/596-test.log`, `/tmp/596-ui.log`, `/tmp/596-ui-focused.log`.

## Files:lines round 1 — lịch sử

Các dòng dưới được ghi ở round 1, trước `ab7d056`; không phải line references của patch round 2.

| File | Dòng thêm/sửa |
| --- | --- |
| [src/features/__tests__/guest-join.spec.tsx](../../src/features/__tests__/guest-join.spec.tsx) | 47 |
| [src/features/__tests__/guest-replace-confirm.spec.tsx](../../src/features/__tests__/guest-replace-confirm.spec.tsx) | 39, 86 |
| [src/features/__tests__/invite-code-redesign.spec.tsx](../../src/features/__tests__/invite-code-redesign.spec.tsx) | 1–52 (mới) |
| [src/features/__tests__/invite-preview.spec.tsx](../../src/features/__tests__/invite-preview.spec.tsx) | 1–90 (mới) |
| [src/features/__tests__/join-by-code.spec.tsx](../../src/features/__tests__/join-by-code.spec.tsx) | 52, 82 |
| [src/features/__tests__/join-tracks-real-join.spec.tsx](../../src/features/__tests__/join-tracks-real-join.spec.tsx) | 36, 56, 112 |
| [src/features/__tests__/redesign-missing-screens.spec.tsx](../../src/features/__tests__/redesign-missing-screens.spec.tsx) | 15 |
| [src/features/gogo-room/guest-join.style.tsx](../../src/features/gogo-room/guest-join.style.tsx) | 5–15, 20–21, 25 |
| [src/features/gogo-room/guest-join.view.tsx](../../src/features/gogo-room/guest-join.view.tsx) | 12, 17, 19, 54–56, 85, 134–135, 175–178, 182, 193, 198, 201–203, 211, 242 |
| [src/features/gogo-room/invite-expired.style.tsx](../../src/features/gogo-room/invite-expired.style.tsx) | 2, 5–9, 11–15 |
| [src/features/gogo-room/invite-expired.view.tsx](../../src/features/gogo-room/invite-expired.view.tsx) | 1–2, 5–8, 12–13, 16–17, 19–41 |
| [src/features/gogo-room/invite-preview.view.tsx](../../src/features/gogo-room/invite-preview.view.tsx) | 1–43 (mới) |
| [src/features/gogo-room/join-by-code.style.tsx](../../src/features/gogo-room/join-by-code.style.tsx) | 6–11, 14, 23 |
| [src/features/gogo-room/join-by-code.view.tsx](../../src/features/gogo-room/join-by-code.view.tsx) | 1, 12, 17, 59, 103, 117, 130, 132–134, 163–165, 167–168 |
| [src/shared/api/__tests__/invite-preview.test.ts](../../src/shared/api/__tests__/invite-preview.test.ts) | 1–25 (mới) |
| [src/shared/api/index.ts](../../src/shared/api/index.ts) | 40 |
| [src/shared/api/invite-preview.ts](../../src/shared/api/invite-preview.ts) | 1–40 (mới) |
| [src/shared/i18n/en.ts](../../src/shared/i18n/en.ts) | 804–827 |
| [src/shared/i18n/vi.ts](../../src/shared/i18n/vi.ts) | 785–808, 879, 886, 936 |

Tài liệu hiện tại: toàn bộ file mới, gồm nguồn Stitch, đối chiếu theo màn, bảng lệch và test evidence.
