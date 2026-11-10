# #617 — Google rating trên thẻ địa điểm AI

Contract `9.3.0-alpha.1` được chép nguyên byte từ artifact BE #841 / #834 do
owner cung cấp; `pnpm api:types` sinh lại `src/shared/api/schema.d.ts`.

`ResultCard` truyền `providerRating`, `providerRatingCount` và
`providerRatingSource` vào model của `PlaceCardSmall`. `RatingChips` chung hiển
thị Google và GoGo riêng, mỗi nguồn có số mẫu và nhãn nguồn; thiếu Google thì
ẩn chip Google. Thẻ unavailable tiếp tục không truyền rating hay các facts
không còn dùng được. Không đổi component/style/telemetry chung.

Không có Zod schema cho assistant responses trong checkout này; HTTP/SSE dùng
generated types. Các trường mới có trong OpenAPI và generated types, không
thêm lớp validation riêng cho thay đổi mapping này.

Regression trong `assistant-redesign-matrix.spec.tsx` kiểm tra cả Light/Dark:
Google `4.7 / 1280` và GoGo `4.6 / 12` có chip riêng, Google có nhãn hiển thị
và accessibility label; response không có Google không hiện chip Google.
Trước sửa mapping: 2 test mới FAIL vì thiếu `place-google-rating`.
Sau sửa: focused suite PASS 56/56.

Checks toàn bộ:

- `pnpm test`: 1756 PASS, 39 SKIP; chỉ 3 FAIL thuộc distribute-wrapper do sandbox
  chặn process inspection (ngoại lệ owner cho phép). Probe `spawnSync('ps', …)`
  trả `EPERM`; không bỏ/đổi test hay chạy ngoài sandbox.
- `pnpm api:check`, `pnpm typecheck`, `pnpm lint`: PASS.
- `pnpm test:ui --runInBand`: PASS 240/240 suites, 3639/3639 tests,
  11/11 snapshots.
- SHA-256 của cả artifact và bản vendored:
  `5bb37efbb7a0ed3b8bfc8abcb53d39f9dc26bb4d84d3717506b4badfc68d0934`.

Không chạy lệnh git trực tiếp. Không suy ra nghiệm thu DEV từ unit/UI tests.
