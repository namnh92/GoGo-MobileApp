# GoGo-MobileApp#585 — Logo chính thức

Nguồn: Stitch project `17315762413421369447`, sheet so sánh
`ed67babc7b7e4195b520cfd8caee0ff2` và brand guidelines
`aa3b2b29faef4df8a097406b5363c4b2`; `.claude/rules/design-system.md` §Logo,
owner 2026-11-09 (cập nhật sau khi xem simulator, PR #587). Sheet so sánh quyết định ribbon SVG phương án A/B;
brand guidelines cũ dùng hình pin khác, không trộn hai bộ geometry.

`GoGoLogo` dùng cùng geometry và palette với script icon. Header `tab-root`
dùng phương án B compact 32×32pt với chữ `go go` 9pt dưới mark; divider dọc
16pt, rộng hairline, màu `border.hairline` thay dấu `·`. Giữ chiều cao, căn giữa,
tiêu đề và action của Trang chủ/Kế hoạch/Đã lưu/Cá nhân.
Splash khôi phục nguyên bản đồ Việt Nam, pin, khoảng cách và cách đo layout
trước #585; chỉ thay chữ `GoGo` bằng phương án B với `go go` và ba chấm
trong đúng slot cao 44pt của chữ cũ (`type.brand.lineHeight`); giữ tagline,
thời gian reveal, minimum hold, chờ hydrate và điều hướng onboarding/session.
Reduced motion hiện trạng thái cuối ngay và không thêm thời gian chờ.
Chữ dùng font Inter ExtraBold đã đóng gói của app; màu chữ theo theme để đọc
được ở cả Light/Dark, palette mark không đổi theo accent.

## Tạo lại icon

Yêu cầu Node >=22.18 và `sharp@0.34.5` (libvips 8.17.3). Script ưu tiên module
local hoặc `GOGO_SHARP_MODULE`, rồi renderer của `@expo/image-utils` nếu có.
Không tải tài nguyên từ mạng trong script. Môi trường thực thi ban đầu thiếu
sharp trong node_modules; bản 0.34.5 và binary Darwin arm64 đã được lấy từ
cache npm có sẵn vào `/tmp/585-icon-tools`, không sửa dependencies/lockfile.

```sh
GOGO_SHARP_MODULE=/tmp/585-icon-tools/node_modules/sharp node scripts/generate-brand-icons.mjs
# Hoặc sau khi có sharp trong node_modules:
node scripts/generate-brand-icons.mjs
# Chỉ tạo SVG, không cần renderer:
node scripts/generate-brand-icons.mjs --svg-only
```

Đầu vào: `src/shared/ui/gogo-logo.asset.ts` + `brandLogo` trong `tokens.ts`.
Đầu ra: SVG trong `assets/brand/`, `assets/icon.png` cho Expo/iOS,
`assets/adaptive-icon.png` (foreground trong suốt, nằm trong safe zone),
`assets/adaptive-icon-background.png` (Deep Navy `#20124A`). PNG đều 1024×1024;
icon iOS không có alpha; không bo góc trước. Hai lần chạy cùng renderer đã
cho SHA-256 giống nhau. `app.config.ts` trỏ tới các PNG này.

Splash native trước khi React sẵn sàng cũng dùng phương án B:
`assets/splash-icon.png` (Light) và `assets/splash-icon-dark.png` (Dark),
1024×948 trong suốt, sinh từ SVG và font Inter ExtraBold đóng gói trong repo.
Script đăng ký font này trước khi rasterize, không dùng font cài trên máy.

Owner cập nhật sau khi xem device (2026-11-09, PR #587): mark icon iOS tăng
15%, scale 2.208 và translate (70.4, 158.72), căn tâm bản vẽ 400×320 tại
(512, 512). Android cũng tăng 15%, scale 1.472 và translate (217.6, 263.68);
bán kính pixel ngoài cùng khoảng 270px, vẫn trong safe zone 313px.
Splash native dùng chữ 68, weight 800, baseline y=338, căn giữa x=200 và bỏ
ba chấm; giữ viewBox 400×370 và PNG 1024×948, không cắt nội dung.
JS Splash và ba chấm của component đó không đổi trong lượt này.

Native icon cần build dev-client mới; OTA/Metro reload không cập nhật icon.
Không tạo native build trong task này.

## Kiểm tra

`brand-logo.spec.tsx` render bốn tab thực và Splash ở Light/Dark, kiểm tra mark,
tiêu đề, action, divider theo token, chữ compact 9pt, bản đồ, wordmark và ba chấm.
`splash-animation.spec.tsx` kiểm tra
minimum hold/hydration/điều hướng, reveal timing, viewport fit và reduced motion.
Gate: `pnpm typecheck`, `pnpm lint`, `pnpm test:ui` (toàn bộ, không filter).
Log gốc: `/tmp/585-typecheck.log`, `/tmp/585-lint.log`, `/tmp/585-test-ui.log`,
`/tmp/585-icons.log`, `/tmp/585-icons-repeat.log`, `/tmp/585-icons-verify.log`.

Lượt sửa PR #587: log `/tmp/587b-typecheck.log`, `/tmp/587b-lint.log`,
`/tmp/587b-test-ui.log`; regression trước sửa ở `/tmp/587b-test-ui-before.log`
(19 test FAIL do thiếu bản đồ, slot splash quá lớn và header còn mark-only).
Kết quả: typecheck PASS, lint PASS; UI suite PASS 218/218, 2999/2999 test,
9/9 snapshot (không filter). `/tmp/587b-layout-verify.log` xác nhận source
splash trước #585 giống hệt sau khi đảo đúng phần thay chữ và import;
style, map, reveal và geometry bản đồ giống hệt bản trước #585.
Chưa xác nhận lượt sửa này trên simulator hoặc icon trong native build. Không commit/push.
