# Bộ nhớ đệm taxonomy (#519)

Hợp đồng `7.3.0-alpha.1` được chép nguyên bản từ BE `origin/re-design`;
`src/shared/api/schema.d.ts` được tạo bằng `pnpm api:types`.
Tham chiếu quyết định BE ADR-0047 (`docs/adr/0047-taxonomy-cache-version.md`).

`useTaxonomies` là nguồn chung cho Home, bộ lọc, sở thích, nhãn địa điểm và
form nhập địa điểm. Mỗi locale tải toàn bộ kinds một lần; lựa chọn kinds chỉ
lọc dữ liệu trong bộ nhớ, không tạo thêm yêu cầu HTTP.

TanStack Query lưu `{ data: { version, kinds }, etag }` dưới prefix `taxonomies`
qua AsyncStorage hiện có. Khóa `['taxonomies', locale, 'current']` trỏ tới bản
hiện hành; `['taxonomies', locale, version]` giữ snapshot tương ứng. Phiên bản
cũ của cùng locale được bỏ khi nhận phiên bản mới. Locale khác giữ cache riêng.
Taxonomy và ETag không hết hạn theo thời gian; chỉ dữ liệu tài khoản và cache
khác hết hạn sau 24 giờ. Khi hydrate cache cũ quá 24 giờ, chỉ giữ taxonomy;
snapshot không bị garbage collection trước khi có phiên bản thay thế. Đăng xuất
xóa cache cùng bộ nhớ ứng dụng; cache buster vẫn loại bỏ định dạng không tương thích.

Sau khi hydrate, app hiển thị cache ngay và revalidate mỗi locale một lần trong
mỗi lần khởi chạy. Yêu cầu gửi `If-None-Match` nếu có ETag và
`Cache-Control: no-cache` để tránh dùng bản cũ từ proxy. Phản hồi 304 giữ dữ liệu,
không đọc body; 200 chỉ thay dữ liệu nếu version đổi. Không cần gọi thêm endpoint
version: conditional list GET kiểm tra generation và BE bỏ truy vấn danh sách
khi validator khớp. Mở màn hình khác không tải lại. Nút thử lại vẫn có thể gọi
`refetch` trực tiếp.

Khi offline, cache vẫn dùng được. Nếu TanStack phát hiện offline trước yêu cầu,
yêu cầu chờ mạng trở lại; nếu transport báo lỗi, dữ liệu cache vẫn ở trạng thái
thành công và được lưu lại. Không có cache thì giữ trạng thái loading/error
hiện có. Đổi ngôn ngữ chọn cache locale tương ứng và kiểm tra locale đó nếu chưa
kiểm tra trong lần khởi chạy hiện tại.
Khi một locale phát hiện generation toàn cục mới, các locale khác mất trạng thái
đã kiểm tra và sẽ revalidate khi dùng lại. Cache cũ vẫn đọc được offline; lỗi
mạng không đánh dấu locale cũ là đã đồng bộ với generation mới.

Không thêm metric riêng: dùng HTTP status/latency hiện có (BE ADR-0047).
Rollback bằng cách hoàn nguyên thay đổi client; prefix mới không chứa thông tin
riêng tư và phiên bản client trước bỏ qua các khóa taxonomy không dùng tới.

Bằng chứng tự động: `taxonomy-cache.test.ts` kiểm tra JSON round-trip, conditional
GET/304 không đọc body, thay version, offline, locale và deduplication;
`taxonomy-hydration.spec.tsx` kiểm tra hook thật với persistence provider và disk
hydrate chậm, đảm bảo không có request trước khi đọc cache xong.
