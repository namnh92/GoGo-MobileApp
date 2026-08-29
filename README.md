# GoGo-MobileApp

Mobile app của **GoGo** — nền tảng giúp cặp đôi và nhóm bạn thống nhất địa điểm, tạo lịch trình và sử dụng kế hoạch trong ngày đi chơi.

Repo này chứa ứng dụng **React Native iOS/Android**: trải nghiệm native, map, push notification, active date và offline plan. Tài liệu nguồn (workspace docs): `GOGO_SRS.md`, `GOGO_IMPLEMENTATION_WBS.md`, `GOGO_FEATURE_IMPROVEMENT_SPEC.md`, `GOGO_ENGINEERING_SKILLS_AND_PLANS.md`, `GOGO_MOCKUP_VERIFICATION_AND_TECHNICAL_APPLICATION.md`.

## Hệ sinh thái GoGo

| Repo | Phạm vi |
| --- | --- |
| [GoGo-BE](https://github.com/namnh92/GoGo-BE) | API BFF, database, search, suggestion, workers, CMS APIs |
| [GoGo-WebApp](https://github.com/namnh92/GoGo-WebApp) | Responsive Web/PWA và Mini Web App |
| **GoGo-MobileApp** (repo này) | React Native iOS/Android |
| [GoGo-Mockup](https://github.com/namnh92/GoGo-Mockup) | Prototype, UI/UX fixtures và design validation |

## Stack định hướng

React Native + TypeScript strict · **Expo Dev Client** (chỉ chuyển bare nếu native dependency bắt buộc) · Expo Router / React Navigation (chốt bằng ADR) · TanStack Query (server state) + Zustand (chỉ UI/workflow state) · React Hook Form + Zod · Secure storage (Keychain/Keystore) · Native map adapter · APNs/FCM abstraction · Crash reporting.

## Cấu trúc thư mục

```text
GoGo-MobileApp/
├── src/
│   ├── app/                  # Navigation, providers
│   ├── features/
│   │   ├── auth/             # Đăng nhập, guest session, claim
│   │   ├── room/             # Tạo/join room, lobby, invite
│   │   ├── preference/       # Chọn sở thích, autosave draft
│   │   ├── search/           # Tìm kiếm, list, place detail
│   │   ├── suggestion/       # Match/vote/kết quả
│   │   ├── plan/             # Itinerary, lock/regenerate
│   │   ├── active-date/      # Stop hiện tại, ETA, directions
│   │   └── profile/          # Saved, plans, review, settings
│   └── shared/
│       ├── ui/               # Warm Liquid Glass native components
│       ├── api/              # Generated client wrapper
│       ├── storage/          # Secure/offline storage adapters
│       ├── navigation/       # Deep link routing
│       ├── analytics/        # Typed events
│       └── providers/        # Map, push, share adapters
├── app.config.ts             # Flavour, bundle id, deep link claim
├── ios/                      # Generate bởi Expo prebuild
├── android/                  # Generate bởi Expo prebuild
└── docs/adr/
```

## Flavour và bundle id

App ship ba flavour, chọn bằng `EXPO_PUBLIC_ENV`. `app.config.ts` là nguồn duy
nhất; `ios/` và `android/` do `expo prebuild` sinh ra nên **không** sửa tay.

| `EXPO_PUBLIC_ENV` | Bundle id (iOS + Android) | Tên trên máy | Scheme |
| --- | --- | --- | --- |
| `dev` | `max.gogo.dev` | GoGo Dev | `gogo-dev://` |
| `stag` | `max.gogo.stag` | GoGo Staging | `gogo-stag://` |
| `prod` | `max.gogo.prod` | GoGo | `gogo://` |

Ba token này cũng là giá trị `EXPO_PUBLIC_ENV` mà app validate lúc chạy
(`src/shared/config/env.ts`) — một từ vựng duy nhất, nên bản build và app chạy
trong nó không thể bất đồng về môi trường. Nhãn trên màn hình vẫn viết đủ
("GoGo Staging") vì icon không phải định danh.

Ba id khác nhau để một máy cài được cả ba: hai app **không thể** trùng bundle
id, và hai app trùng scheme thì `gogo://` mở app nào là tuỳ hệ điều hành chọn
lần cuối. Giá trị lạ (kể cả `production` viết đủ) làm **fail build**, không tự đoán —
đoán nghĩa là một biến CI gõ sai sinh ra bản store tên "GoGo Dev" và chỉ phát
hiện sau khi upload.

Đổi bundle id là đổi cấu hình bên ngoài repo: OneSignal (app theo bundle id),
Tenjin, App Store Connect / Play Console, và ràng buộc key Google Maps.

## Deep link contract

```text
https://gogo.app/r/{inviteCode}     # chỉ prod claim domain này
gogo://room/{inviteCode}
gogo://plans/{planId}
gogo://places/{placeId}
```

Chỉ **`prod`** khai `associatedDomains` và intent filter cho `gogo.app`.
Universal link được xác minh theo danh sách app id trong
`apple-app-site-association` / `assetlinks.json` của domain; một bản dev claim
domain không nêu tên nó là claim không bao giờ verify được — Android đưa vào
chooser dưới dạng handler chưa xác minh, iOS bỏ qua. `dev`/`stag` dùng scheme
riêng ở bảng trên.

Phải test: cold start, warm start, đã đăng nhập, guest, invite hết hạn, app chưa cài. Invite code không chứa PII.

## Nguyên tắc cốt lõi

- Server state thuộc TanStack Query; Zustand chỉ giữ draft/flow/session flags — không nhân bản server state dài hạn trong global store.
- Permission (location/notification) chỉ hỏi đúng ngữ cảnh, luôn có fallback (nhập khu vực thủ công khi từ chối location).
- Offline: cache plan hiện tại + tóm tắt place tối thiểu cho active date; draft có version + sync; **xóa sạch room data cache khi logout**.
- Map/provider lỗi → vẫn hiển thị List + mở external directions URL. Push chỉ là trigger — luôn refetch API khi mở app.
- Native module mới cần ADR (build, privacy manifest, bảo trì).
- Token trong Keychain/Keystore; không token trong URL/log.
- UI theo Warm Liquid Glass tokens; WCAG 2.2 AA; touch target ≥ 44×44; i18n vi/en.

## Local development (dự kiến — chốt tại Sprint 0)

Yêu cầu: Node.js LTS, pnpm, Xcode và Android Studio/JDK theo version khóa trong project.

```bash
pnpm install
cp .env.example .env.local
pnpm start          # Expo Dev Client
```

Lệnh chuẩn mục tiêu: `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`.

> Script sẽ được chốt khi Sprint 0 hoàn thành; README này không phải bằng chứng command đã tồn tại.

## Git

Git Flow: `master` (production, tag `vX.Y.Z`) · `develop` (integration) · `feature|bugfix/GOGO-<ticket>-<name>` · `hotfix/GOGO-<ticket>-<name>` · `release/x.y.z`. PR bắt buộc, CI xanh, ≥1 approval.

## Backlog

Backlog theo `GOGO_IMPLEMENTATION_WBS.md` §6, quản lý bằng GitHub issues (label `wbs`):

| Task | Phạm vi | Size |
| --- | --- | --- |
| `APP-001` | App shell, navigation, theme/token | M |
| `APP-002` | Auth, secure token storage, guest claim | M |
| `APP-003` | Universal/App links, invite, native share | M |
| `APP-004` | Create/join/lobby/preference flows | L |
| `APP-005` | Search, native map, location permission | L |
| `APP-006` | Place, vote, result, plan editor | L |
| `APP-007` | Active date, local plan cache, external navigation | L |
| `APP-008` | Push token, notification routing | M |
| `APP-009` | Saved/review/profile/settings | M |
| `APP-010` | Store build, crash/perf/a11y hardening | L |

Mobile core nằm ở Sprint 6; app shell (`APP-001`) có thể chạy song song ngay sau Sprint 0 theo mục "Công việc có thể chạy song song" của WBS.

## Trạng thái

**Sprint 0 — skeleton + APP-001 đang triển khai.** `ios/`, `android/` sẽ được generate bằng Expo prebuild.
