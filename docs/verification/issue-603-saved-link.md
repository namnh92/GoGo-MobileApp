# GoGo-MobileApp #603 — Đã lưu → Bổ sung thông tin

Phạm vi: UI/navigation trên re-design, theo yêu cầu owner 2026-11-10. Không thay đổi API,
quy tắc submit/dedup hay backend. Không chạy git. Owner nghiệm thu trên simulator.

## Thay đổi

- Đã lưu dùng `ImportFlowController.resolveLink` và cùng dependency `resolveGoogleMapsLink`
  với import. Không tự submit địa điểm và không resolve lần hai khi mở wizard.
- Giữ kết quả resolve, resolution proof và lỗi trong một handoff bộ nhớ theo session,
  hết hạn sau 60 giây. Route chỉ chứa ID handoff; không chứa resolution proof/payload.
- Kết quả RESOLVED có candidate: `/places/import` không render form nhập link, mà
  replace sang `/places/contribution`. Route này dùng lại màn import và ContributionWizard.
  Provider được khởi tạo sẵn bằng kết quả resolve, nên wizard không chớp form nhập link.
- Header Back của luồng từ Đã lưu quay về Đã lưu, qua xác nhận bỏ/lưu nháp hiện có nếu cần.
- Link sai định dạng hoặc resolve lỗi: mở form import với link đã nhập và cảnh báo
  format/provider/rate-limit/offline hiện có. UNRESOLVED và CANDIDATE_SELECTION tiếp tục
  render nhánh import tương ứng. Địa điểm đã có giữ quick save và feedback hiện tại;
  submit proposal pending/dedup giữ controller hiện có.
- Verify dùng BlockingLoadingOverlay chứa LoadingIndicator dùng chung. Chặn bấm lặp;
  bỏ kết quả về muộn sau blur/unmount/đổi session. Đăng xuất xóa trạng thái busy/input.
- Khai báo route mới trong danh sách screen template của Sentry.

## Kiểm tra tự động

`src/features/__tests__/saved-link-import.spec.tsx` kiểm tra:

- Thành công → replace sang wizard; Back về Đã lưu; chỉ gọi resolve một lần.
- Sai định dạng → import có link và cảnh báo, không gọi resolve.
- Resolve lỗi thường/provider/mạng → import có link và cảnh báo tương ứng.
- LoadingIndicator hiện khi verify và chặn bấm Lưu lặp.
- Giữ quick save địa điểm đã có, UNRESOLVED, chọn candidate và submit dedup/pending.
- Resolution proof được giữ đến submit; handoff/kết quả cũ không vượt qua đổi session.

Các test sẵn có của Saved vẫn kiểm tra blur/refocus, request cũ/mới và lỗi lưu địa điểm.
Kết quả cuối ngày 2026-11-10:

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | PASS, exit 0 |
| `pnpm lint` | PASS, exit 0 |
| `pnpm test:ui --runInBand` | PASS, exit 0; 234 suites, 3.444 tests, 11 snapshots |
| Saved/import + screen-tag (focused) | PASS; 3 suites, 119 tests |

Lượt full suite đầu phát hiện thiếu screen template của route mới (2 assertions).
Đã bổ sung template, chạy lại focused và toàn bộ suite đạt kết quả trên.

Regression negative control: tạm thay đúng nhánh điều hướng thành công bằng hành vi
URL-only cũ (`router.push` sang import chỉ với `url`). Test `resolves once, replaces import
with the wizard, and Back returns to Saved` FAIL đúng tại assertion không được hiện
`import-link-input`: form nhập link vẫn xuất hiện với link đã điền sẵn. Sau đó phục hồi
nguyên byte bản sửa, xác nhận SHA-256 không đổi và chạy lại cùng test: PASS. Đây là
rollback riêng nhánh điều hướng để tái hiện cơ chế lỗi, không phải checkout toàn bộ bản cũ.

Snapshot các file source/test được sửa: [issue-603-source-manifest.json](issue-603-source-manifest.json).
Log lệnh trong máy: `/tmp/mobile603-typecheck.log`, `/tmp/mobile603-lint-final.log`,
`/tmp/mobile603-ui-final.log`, `/tmp/mobile603-focused-final.log`,
`/tmp/mobile603-regression-before.log`, `/tmp/mobile603-regression-after.log`.

## Owner kiểm trên simulator — NOT RUN

1. Tại Đã lưu, dán link địa điểm mới hợp lệ, bấm Lưu: thấy loading, sau đó Bổ sung thông
   tin; không cần Enter/Tiếp tục ở form Thêm địa điểm. Back quay về Đã lưu.
2. Link sai định dạng: mở Thêm địa điểm mới với nguyên link và cảnh báo format.
3. Link không resolve được hoặc provider lỗi: mở Thêm địa điểm mới với link và lỗi.
   Sửa link hoặc thử lại tiếp tục được như luồng import hiện có.
4. Link địa điểm đã có: quick save/feedback như hiện tại. Link có proposal pending:
   kiểm tra submit/dedup như luồng hiện tại, không phát sinh submit tự động.
5. Kiểm tra loading Light/Dark, Back hệ thống/gesture và xác nhận bỏ/lưu nháp khi đã sửa.
