# GoGo-MobileApp #482 — nhóm 03

Ngày 2026-11-07. Branch `feature/GOGO-482-redesign-g03-places`, base/head ban đầu
`abe784c` (`origin/re-design`). Thay đổi chưa commit. Refs #482.

## Trạng thái và thiết kế

Đã triển khai phần hành vi/dữ liệu bên dưới theo plan đã duyệt và quyết định
owner 2026-11-07. **Chưa hoàn tất nghiệm thu visual.** Không tuyên bố khớp Stitch.

Nguồn scope: `dev/handoffs/mobile-g03-plan.md` và phần `codex` cuối của
`dev/handoffs/codex-advise-mobile-g03.astra.out` trong workspace GoGo.
Các ID Light trong plan thuộc project `17315762413421369447`:

| Màn | Light node | Diff đã viết |
| --- | --- | --- |
| 3.1 detail | `1593725092880141532` | Gallery ghép GoGo trước, Google transient sau; credit ảnh theo ảnh đang xem; rating dùng formatter chung, GoGo aggregate thật; giờ tuần trong Sheet; report qua API; reviews phân trang trong detail; bỏ suitability bars. Giữ contact, map/directions, AI gate/context và CTA seed tạo kèo. |
| 3.2 không ảnh | `11113939438694287499` | Dùng chung detail; empty hero khi cả hai nguồn không có ảnh; không có gallery controls giả; lỗi ảnh vẫn qua fallback của PlacePhoto. |
| 3.3 import | `10756253768045112131` | Header “Thêm địa điểm mới” + bell; intro/nhãn link/kết quả; clipboard chỉ đọc khi bấm; preview variant không có canonical ID; giờ/rating/category thật; save khóa có lý do; metadata mở rộng; credit chỉ cho registered user và chỉ sau approval; link Google dùng googleMapsUri. |
| 3.4 trạng thái | `11596318734062514103` | Resolve hoặc submit ALREADY_EXISTS mở card canonical có loading/error/retry/save; copy “Địa điểm này đã có trên GoGo”; approved/merged mở được đích; polling 403 owner-only có thông báo riêng, không biến thành rejected; link nhập mang nhãn riêng; reset xóa dữ liệu form. |

Đọc Stitch trực tiếp bị chặn trong phiên: browser inventory báo
`The browser access host is unavailable`; cả lần bind Chrome bằng bundle ID và
tên app đều báo `cgWindowNotFound`. Công cụ từ chối mở Finder để khôi phục.
Không sửa Stitch. Không có Dark IDs/HTML parity mới hay ảnh app–Stitch của phiên
này: **0/8 đối chiếu Light/Dark**. Geometry/crop/typography/color/spacing và parity
của bốn màn vẫn cần đọc trực tiếp và đo; các mô tả visual trong plan không thay
thế bằng chứng này. Giữ category ở vị trí hiện hữu; mọi khác biệt so với Stitch
cần đi vào bảng lệch workspace khi công cụ hoạt động lại.

## Các điểm Astra

1. Provider photos chỉ fetch ở detail; `gcTime=0`, không refetch theo focus/reconnect,
   không retry tự động, query root không được persist. Ảnh inline dùng
   `cachePolicy="none"`. Disabled/not-linked/budget-exhausted/unavailable/unknown
   không thêm ảnh; không gọi endpoint này cho import/card.
2. Reviews gửi `limit=10`, cursor thật; dùng items, giữ compatibility reviews.
   Helpful sửa mọi page và cả hai mảng, rollback snapshot, nhận count server rồi
   invalidate cả latest/helpful và marks. UI loại duplicate IDs và có retry trang sau.
3. Submit ALREADY_EXISTS không phụ thuộc submissionId; canonical ID được mở/lưu
   ngay. Candidate-selection cũng hiển thị kết quả submit/polling.
4. Save/helpful cần user; report cho user hoặc room guest. Không award credit
   cục bộ, không suy ra credit từ merged/balance/deduped.
5. Giờ Việt Nam độc lập timezone thiết bị; thiếu giờ là unknown, không closed.
   Clock cập nhật mỗi 30 giây và khi resume; giữ overnight. Matching/swipe dùng
   cùng clock/helper.
6. Preview gắn URL đã resolve. Sửa link bỏ preview/token/selection/metadata;
   submit kiểm tra lại URL bằng ref. Retry chỉ resolve URL đã xác minh, tối đa
   một lần. Generation tăng khi edit/reset/xác minh mới; continuation cũ bị bỏ
   cả khi URL đổi A→B→A. Cleanup cũ không mở lock của attempt mới.
7. Copy 3.3 “Đã tìm thấy trên Google Maps” dùng màu trung tính; 3.4 chỉ khẳng định
   catalog existence. Không có menu/photos/100%/giới hạn loại địa điểm giả.
8. PlaceCard preview nhận generated candidate, không gán googlePlaceId vào place.id,
   không có navigation/save handler canonical. Canonical result dùng PlaceCard
   hiện hữu. Không dựng ảnh/price/verification/số nhóm từ mẫu.
9. Full detail đổi sang key có discriminator detail, không persist, staleTime=0.
   Header và list dùng chung query/order và aggregate trang đầu nếu có; không
   ghi chéo vào detail cache, không tính từ sample. Reviews/marks không persist.
   Cache buster alpha.3 bỏ cache cũ đã chứa
   aggregate. **Hệ quả:** lần nâng cấp đầu tiên cần online để nạp lại cả cache plan;
   sau đó plan/stop summaries vẫn được persist, full detail chỉ có memory fallback.
10. Chưa đóng visual/device acceptance: cần direct Stitch, HTML parity, hai theme,
    iOS/Android, vi/en, anonymous/guest/user và kiểm tra thủ công/a11y. Các unit/UI
    tests bên dưới chỉ là bằng chứng trong phạm vi đó.

## Contract và dữ liệu

Dùng nguyên `openapi/gogo.v1.yaml` và generated `schema.d.ts` hiện có:

| Operation | Client dùng |
| --- | --- |
| getPlaceDetail / getPlaceProviderPhotos | canonical facts và transient base64 + author credits |
| listPlaceReviews | order, limit, cursor; items, nextCursor, gogoRating/count, verifiedVisit |
| reportPlace | stable reasonCode, note tối đa 500 ký tự, Idempotency-Key giữ nguyên qua retry |
| resolveGoogleMapsLink / submitPlace / getPlaceSubmission | token theo URL, canonical ID, moderation status, 403 owner-only |
| saved / helpful hiện hữu | chỉ canonical place ID hoặc review ID thật |

Không thay public contract, không sinh lại types, không thêm migration/package.
Report form dùng RHF + Zod, normalize CRLF và chặn control characters. Event mới
`place_report_submitted` chỉ gửi sau API success, props `placeId` và reason key;
không chứa note, link hoặc resolution token. Chưa gọi DEV hay provider thật.

## Phần chờ BE — không stub, không render

| Issue | Phần chưa làm |
| --- | --- |
| GoGo-BE#784 | Detail chưa có areaSummary: `formatPlaceAddress(detail)` giữ raw addressText; helper ưu tiên verified short label khi contract thật có field. Sau BE cần cập nhật contract/types và adapter canonical card. |
| GoGo-BE#785 | Không render checked-in group count ở detail/status. |
| GoGo-BE#786 | Không render candidate photo; không dùng ảnh mẫu hay gọi provider-photos để lấp chỗ trống. |
| GoGo-BE#787 | Submission rejected chỉ có status chung; không dựng reason key/câu lý do cụ thể. UNRESOLVED vẫn dùng reasonCodes đã có trong contract. |
| GoGo-BE#788 | Không tạo my-submissions list hay entry “Đóng góp của tôi” trong Cá nhân. Chờ contract và Stitch màn mới. |

## Điểm đọc code

- `src/features/date-plan/place-detail.view.tsx`: gallery, ratings, hours, address seam, report, legacy review anchor.
- `src/features/date-plan/place-reviews.view.tsx`: pages, retry, total, verified visit, helpful.
- `src/features/date-plan/place-report.{view,style}.tsx`: report form và shared Sheet.
- `src/features/date-plan/place-reviews-page.view.tsx`: redirect deep link cũ về detail section reviews.
- `src/features/place-import/import.view.tsx`: URL proof, clipboard, form, moderation branches.
- `src/features/place-import/existing-place-result.view.tsx`: canonical read/save/error states.
- `src/shared/ui/place-card.view.tsx`: preview model không canonical ID; rating-chips/place-photo dùng chung.
- `src/shared/api/queries/use-places.ts`, `review-reactions.ts`, `queries/use-me.ts`: endpoints/hooks, paging, optimistic cache.
- `src/shared/api/persist-policy.ts`, `query-keys.ts`, providers/app-providers: cache boundary và cold-start invalidation.
- `src/shared/api/view-models.ts`, `src/shared/ui/use-place-clock.ts`, matching callers: giờ Việt Nam/resume.
- `src/shared/administrative/place-address.ts`: raw-address fallback và short-label seam.

## Kiểm chứng

Kết quả được ghi trước Astra r1 (không rerun các gate này trong phiên sửa r1):

| Kiểm tra | Kết quả |
| --- | --- |
| Jest scoped (23 suites) | **182/182 PASS**, exit 0; log `/tmp/g03-scoped-final.log` |
| Vitest review-reactions / view-models / offline-cache | **58/58 PASS**; chạy với TZ=UTC và TZ=America/Los_Angeles |
| `pnpm exec tsc --noEmit --pretty false` | PASS, exit 0 |
| ESLint tất cả file .ts/.tsx modified/untracked của task | PASS, exit 0; log `/tmp/g03-eslint-final.log` |
| `git diff --check` | PASS |
| `git diff --name-only -- ios` | Rỗng |

Jest scoped bao gồm: reviews/helpful/rollback; import token, URL A→B, retry về
muộn, provider outage, FUTURE_OPENING, submit ALREADY_EXISTS và owner-only 403;
canonical detail 404/503; report user/guest/anonymous và note validation;
pagination limit/cursor/order/aggregate; provider query disposal và image
cachePolicy; clock closing-time/resume; detail facts/offline/sheets; vi/en date
pins; shared PlaceCard/RatingChips; AI context; matching/swipe regression.
Các endpoint trong test được mock; không có DEV/network acceptance.

Full repo gates, HTML parity và device visual, independent review, commit/push
thuộc Claude theo lệnh owner. Không chạy DEV, không sửa ios/, không commit/push.
Rollback code: revert patch này cùng cache policy/buster; không có DB migration.
Không hạ cache buster trên thiết bị như cách phục hồi dữ liệu cache cũ.

## Astra r1 — F-01 / F-02, base `3596fbf`

Sửa ngày 2026-11-07, chưa commit. F-01 dùng generation theo lần nhập/xác minh;
kiểm tra sau submit và re-resolve, bỏ retry và cleanup đã hết hiệu lực. F-02
đưa query/order reviews lên detail, truyền cùng kết quả xuống list và ưu tiên
aggregate trang đầu cho header. Khi chưa có aggregate, giữ fallback detail;
count 0 hoặc score bị bỏ dưới ngưỡng không giữ lại score cũ.

Cùng hai file regression (`place-import-resolution-token.spec.tsx`,
`place-rating-refresh.spec.tsx`) chạy với production source tại `3596fbf`, rồi
với source đã sửa:

```text
FAIL-before @3596fbf — exit 1
Test Suites: 2 failed, 2 total
Tests:       5 failed, 9 passed, 14 total

PASS-after — exit 0
Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total

Jest scoped import/detail/reviews/hooks — exit 0
Test Suites: 11 passed, 11 total
Tests:       73 passed, 73 total
```

FAIL-before gồm hai continuation A→B→A (submit và resolve), lock attempt mới,
detail response về cuối làm header sai, và ghi chéo detail cache khi reviews
response về cuối. PASS-after còn kiểm tra metadata giữ nguyên khi retry hợp lệ,
order helpful, pagination không thay aggregate trang đầu và count 0.

Lệnh focused: `pnpm exec jest --runInBand src/features/__tests__/place-import-resolution-token.spec.tsx src/features/__tests__/place-rating-refresh.spec.tsx`.
Scoped gồm hai file trên, `places-g03-hooks`, `place-import-status`,
`place-import-future-opening`, `place-import-provider-outage`, `place-detail-facts`,
`place-detail-sheet`, `place-detail-offline`, `place-reviews`, `place-reviews-helpful`.
Logs: `/tmp/g03-r1-before.log`, `/tmp/g03-r1-after.log`, `/tmp/g03-r1-scoped.log`.
`git diff --check` PASS; không sửa `ios/`, không install/commit/push/network.
Visual acceptance vẫn **0/8**, chưa hoàn tất. Không rerun full gates,
typecheck/lint hay DEV/device acceptance trong phiên sửa này.

## Owner verification fixes — 2026-11-07, base `fe641cc`

Working-tree patch only; no install/commit/push or `ios/` changes.

1. Existing-place card → action group uses `spacing[4]` (16pt); actions use
   `spacing[3]` (12pt) gap. The lone centered “Liên kết đã nhập” control under
   “Kết quả phân tích” was removed. Canonical open/save/reset remain wired.
2. Preview has an image slot in the shared PlaceCard preview variant. The
   optional runtime `candidate.photo` reference is checked against BE PR #792
   (`4ca9b46`): `/v1/places/google-provider-photo/{googlePlaceId}` returns JSON,
   not image bytes directly. The API adapter strips the already-configured v1
   prefix, requests only that candidate path, displays validated returned bytes
   plus response attribution/author names, uses `cachePolicy="none"`, and aborts
   on change/unmount. Missing/denied/error/empty/broken photos render nothing;
   no placeholder, direct Google request, provider-detail request or persisted
   query/image cache. Generated contract files remain unchanged until BE lands.
3. “Thêm ảnh” opens the real installed Expo library picker after contextual
   permission; up to five local previews, remove, cancellation/denial/error,
   reset on link change. It is optional and shows an explicit local-only notice.
   **Wired:** picker, previews and removal. **Waiting for BE#793:** upload,
   attachment identifiers, submit integration and server capability discovery.
   The current contract capability is explicitly closed (`upload: false`);
   no upload endpoint is invoked, no local URI/photo field enters submit,
   and no photo-upload success is claimed. Normal text-only submit stays wired.
4. Link input is explicitly single-line with native horizontal scrolling, right
   inset for an accessible 44×44 clear control. Clear invalidates the attempt
   and resets preview/token/metadata/photos.
5. KeyboardAvoidingView bounds the scrolling body; focus groups measure both
   price fields and helper, and note plus counter/helper. Focus, keyboard show
   and viewport resize reveal the whole group with token clearance. Outside
   taps and dragging dismiss the keyboard. Solid header stays outside scrolling
   and keyboard avoidance; note has a bounded, internally scrolling input.

Validation: **Jest 7 suites / 94 tests PASS** (exit 0), including 19 new owner
regressions, all prior import suites and shared PlaceCard. Command:

```sh
node_modules/.bin/jest --runInBand \
  src/features/__tests__/place-import-owner.spec.tsx \
  src/features/__tests__/existing-place-result.spec.tsx \
  src/features/__tests__/place-import-resolution-token.spec.tsx \
  src/features/__tests__/place-import-status.spec.tsx \
  src/features/__tests__/place-import-future-opening.spec.tsx \
  src/features/__tests__/place-import-provider-outage.spec.tsx \
  src/shared/ui/__tests__/place-card.spec.tsx
```

Log: `/tmp/g03-owner1-final.log`. Formatter applied to changed import views/styles,
new API adapter and regression tests; `git diff --check` PASS. No full gate run.
Keyboard tests mock native geometry; they prove reveal/group/blur behavior, not
native iPhone reachability. No new device acceptance claim. Stitch inventory
returned `The browser access host is unavailable`; saved 3.3/3.4 notes were used,
so spacing/source-section changes are not a claim of measured Stitch parity.
`RTK.md` was absent in this worktree and checked parent paths.
