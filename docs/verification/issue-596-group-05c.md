# GoGo-MobileApp #596 — nhóm 05C: Lời mời và vào phòng

Ngày: 2026-11-10 (Asia/Ho_Chi_Minh). Nhánh `feature/GOGO-596-redesign-g05c-invite`, HEAD thực tế `c87ed82` (cũng là merge-base với `origin/re-design` local), đã gồm #587 và #590 sau `c48d501` được mô tả trong task. Giữ nguyên HEAD/branch, không rebase/reset. Không commit, push, mở issue hay PR.

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
| Mapping màn unusable cho 404 / ROOM_NOT_JOINABLE / ROOM_EXPIRED | 5.19 | Nhánh UI mới trong guest-join error handling; trước đây inline error. | Giữ nghĩa thông báo cũ và endpoint/handler join; room closed/expired không khuyên xin link mới. INVITE_NOT_USABLE/410 khác → 5.18. Typed-code giữ inline mapping cũ. |
| AppHeader, tên khách bắt buộc, thông báo thay phiên, spinner, token font/button/accent | Cả nhóm | Thành phần dùng chung và hành vi hiện hữu phải được giữ; Stitch không mô tả đầy đủ các trạng thái này. | Giữ shared AppHeader/Button/LoadingIndicator và token role; CTA một filled primary; không override pressed highlight. Guest form giữ max 50 và trim. |

## Kiểm tra

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

## Files:lines thay đổi

Các dòng dưới tính trên working tree cuối; không có commit mới.

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
