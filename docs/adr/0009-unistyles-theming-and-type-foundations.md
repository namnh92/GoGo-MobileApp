# ADR 0009 — Unistyles làm theme engine, token ngữ nghĩa, màu nhấn theo chủ đề, font Inter

Trạng thái: chấp nhận để triển khai · 2026-09-24 · GoGo-MobileApp#293 (bước A: #294) · Bổ sung ADR 0002 (jest)

## Bối cảnh

Bản redesign (#293) chốt nền tảng thị giác mới và một cài đặt "Màu chủ đề" với
bốn lựa chọn. Trên `develop@6ab2f65` màu nhấn là hằng số: khoảng 108 tham chiếu
`brand.coral*` trong 48 file, 53 file gọi `StyleSheet.create` của React Native —
một đối tượng tĩnh không thể đổi theo lựa chọn lúc chạy. Không có font tuỳ chỉnh;
thang chữ mang `fontWeight`, mã mời dùng Menlo. `frontend-libs.md` đã ghi
`react-native-unistyles` là thư viện chốt cho theme nhưng chưa cài.

Đo tương phản (WCAG 2.2) trên giá trị khởi điểm của spec: chữ trắng trên
`accent.primary` đạt Cam 3,70 · Xanh lá 3,20 · Xanh dương 3,96 · Tím 4,56 — ba
trên bốn dưới ngưỡng AA 4,5 cho chữ nhãn 13 pt. `status.success` (#4FAF86) trên
trắng chỉ 2,69, `status.warning` 2,63: không thể làm màu chữ.

## Quyết định

1. **Theme engine = `react-native-unistyles` 3.2.5 + `react-native-nitro-modules`
   0.36.1 (ghim đúng phiên bản).** Bốn theme `orange | green | blue | purple`, mặc
   định `orange`, đăng ký trong `src/shared/ui/unistyles.ts`; file này được import
   ngay sau `expo-router/entry` trong `index.ts` (entry mới của app) để chạy trước
   mọi `StyleSheet.create`. Không bật adaptive theme (dark mode ngoài phạm vi).
   Babel plugin `react-native-unistyles/plugin` với `root: 'src'`; jest nạp
   `react-native-unistyles/mocks` rồi file cấu hình qua `setupFiles`.
   `react-native-edge-to-edge` **không** cài: tuỳ chọn từ unistyles 3.1.0 và Expo
   SDK 54 đã bật edge-to-edge trên Android.
2. **Token ngữ nghĩa trong `tokens.ts`** (file thuần TypeScript, vitest đọc được):
   `surface.{canvas,card,subtle}`, `border.hairline`, `text.{primary,secondary,
   tertiary}`, `status.{success,warning,danger,info}` + `*Soft` + `*Text`,
   `shadows.{card,cta,toast}`, `glass.bar`, `fontFamily`, `accents`.
   `text.secondary` giữ `#746E68` (không phải `#817B74` của Figma; quyết định
   owner 2026-09-24 — 4,18 trên trắng là dưới AA). `colors.brand`/`neutral` giữ
   làm palette thô.
3. **Theme = vai trò cố định + một bảng màu nhấn** (`src/shared/ui/theme.ts`).
   Chỉ `accent.*` và `shadows.cta.shadowColor` khác nhau giữa bốn theme; test
   `theme.test.ts` khoá điều đó. Giá trị `primary` được làm đậm đúng tông (giữ hue,
   saturation; hạ lightness) tới khi chữ trắng đạt ≥ 4,5 trên cả trắng lẫn ivory;
   `pressed` luôn tối hơn `primary`; `soft` giữ nguyên:

   | Chủ đề | primary (spec → dùng) | trắng / ivory | pressed (spec → dùng) | soft |
   |---|---|---|---|---|
   | Cam | #E2573F → **#CA381F** | 5,13 / 4,63 | #C24633 → **#A72E19** | #FFE3DA |
   | Xanh lá | #2FA36B → **#247D52** | 5,08 / 4,59 | #248455 → **#1B5E3E** | #D9F3E5 |
   | Xanh dương | #2F7FE6 → **#1A6CD5** | 5,06 / 4,57 | #2565BF (giữ) | #DCEAFF |
   | Tím | #7A5AF5 → **#7250F4** | 5,04 / 4,55 | #6247CC (giữ) | #E6E0FF |

   `pressed` của Cam và Xanh lá phải đổi vì giá trị spec sáng hơn `primary` mới.
   Màu chữ trạng thái: `successText #377A5E`, `warningText #97641B`, `dangerText
   #C63C4E`, `infoText #6857E6` (đều ≥ 4,5 trên trắng và ivory; `danger`/`info` có
   thêm vì cùng quy tắc — nhãn "Xoá" trên ivory với `#C84455` chỉ 4,30).
   `contrast.test.ts` lặp bốn theme và bốn màu chữ trạng thái. **Design duyệt lại
   các giá trị này**; đổi thì đổi hằng số, test là cổng.
4. **Font Inter nhúng lúc build** (`assets/fonts/Inter-{Regular,Medium,SemiBold,
   Bold,ExtraBold}.ttf`, SIL OFL 1.1, tên file = PostScript name) qua config plugin
   `expo-font`. `type.*` = `{ fontFamily, fontSize, lineHeight }`, **không**
   `fontWeight`: Android không tổng hợp độ đậm cho font tuỳ chỉnh (ra bold giả từ
   file Regular), iOS thì âm thầm chọn mặt khác. Thang giữ 6 cỡ / 7 style; **không
   thêm `mono`**, mã mời dùng `body` + `adjustsFontSizeToFit` (owner 2026-09-24;
   phần view đổi ở #295). Không dùng `useFonts` (font nạp lúc chạy = một khung hình
   font hệ thống trước).
5. **`Text` primitive** (`src/shared/ui/text.tsx`): `variant` ∈ 7 style, `color` ∈
   khoá ngữ nghĩa (mặc định `body` / `text.primary`); `style` chỉ nhận layout (các
   khoá chữ/màu bị loại ở mức type). Đọc theme qua `useUnistyles()` — chỉ theo dõi
   `theme`, nên đổi hướng màn hình không render lại chữ.
6. **Lưu lựa chọn cục bộ**: AsyncStorage `gogo.theme.accent.v1`, zod kiểm tra giá
   trị đọc lên, mọi lỗi → `orange`. Bootstrap trong `AppProviders`: đọc → `Unistyles
   Runtime.setTheme` → ẩn splash. Root layout gọi `SplashScreen.preventAutoHideAsync()`
   nên khung hình đầu tiên đã đúng màu người dùng chọn. Khoá theme là khoá phân loại
   (taxonomy key), nhãn qua i18n (#297). Không có gì ở phía server.
7. **Cổng**: `contrast.test.ts` (4 theme + status text), `type-scale.test.ts` (6 cỡ,
   mỗi style một mặt Inter, không `fontWeight` trong token, cấm `fontFamily:` ngoài
   token, ratchet `fontWeight:` theo file — 96 dòng hiện có giảm dần ở #295–#298,
   #298 xoá bảng), `theme.test.ts`, `accent-preference.test.ts`, `text.spec.tsx`,
   `app-providers.spec.tsx` (thứ tự setTheme → hideAsync).
   `scripts/check-native-project.mjs` kiểm tra 5 font trong `Info.plist`/bundle iOS
   và `assets/fonts` Android, pod `Unistyles` + `NitroModules` trong `Podfile.lock`.

## Lựa chọn đã cân nhắc

- **React context + `makeStyles(theme => …)` tự viết** (đề xuất SA ban đầu): không
  thêm native dependency, nhưng mọi màn hình render lại khi đổi theme và phải tự
  duy trì cache style. Owner chọn thư viện đã chốt trong `frontend-libs.md`.
- **Giữ `fontWeight` + `fontFamily: 'Inter'` với XML font family trên Android**
  (`expo-font` hỗ trợ `fontDefinitions`): iOS và Android sẽ resolve khác cơ chế;
  một chuỗi PostScript cho cả hai đơn giản hơn và test được bằng grep.
- **Roboto Mono cho mã mời**: bỏ — thêm một họ font cho một dòng chữ; `body` co
  chữ là đủ.
- **Giữ giá trị accent của spec và chấp nhận dưới AA**: bị loại; spec §"Tiêu chí"
  yêu cầu 4,5:1 ở cả bốn chủ đề.

## Hệ quả

- Native dependency mới (Nitro + Unistyles) → **prebuild và dev client mới** cho
  mọi máy (xem memory `ios-build-needs-prebuild`); `pnpm check:native` bắt thiếu pod
  hoặc font.
- Các file `.style.tsx` chuyển dần sang `import { StyleSheet } from
  'react-native-unistyles'` và `StyleSheet.create(theme => …)` khi được chạm ở
  #295–#297; #298 gom nốt và thêm lint cấm `Text`/`StyleSheet` từ `react-native`
  trong `features/` và `shared/ui`.
- Style cũ có `fontWeight` đè lên `...type.*` tạm thời cho bold giả trên Android;
  ratchet ngăn phát sinh thêm.
- Cam mới (#CA381F) đậm hơn coral cũ (#D84F4A, 4,09 trên trắng) — người dùng chưa
  chọn theme sẽ thấy nút chính tối hơn một chút; đó là chi phí của AA.

## Rollback

Gỡ hai gói + Babel plugin + `setupFiles`, đưa `main` về `expo-router/entry`, đổi
`type.*` về `fontWeight` và gỡ plugin `expo-font` — rồi prebuild lại. Token ngữ
nghĩa và `Text` primitive không phụ thuộc engine (chỉ `text.tsx` và
`use-accent-bootstrap.ts` import unistyles) nên giữ được khi lùi.
