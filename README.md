# GoGo-MobileApp

Mobile app của **GoGo** — nền tảng giúp cặp đôi và nhóm bạn thống nhất địa điểm, tạo lịch trình và sử dụng kế hoạch trong ngày đi chơi.

Repo này chứa ứng dụng **React Native iOS/Android**: trải nghiệm native, map, push notification, active date và offline plan. Tài liệu nguồn (workspace docs): `GOGO_SRS.md`, `GOGO_ENGINEERING_SKILLS_AND_PLANS.md`, `GOGO_MOCKUP_VERIFICATION_AND_TECHNICAL_APPLICATION-2.md`.

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
├── ios/                      # Generate bởi Expo prebuild
├── android/                  # Generate bởi Expo prebuild
└── docs/adr/
```

## Deep link contract

```text
https://gogo.app/r/{inviteCode}
gogo://room/{inviteCode}
gogo://plans/{planId}
gogo://places/{placeId}
```

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

## Lộ trình

M1 Shell (nav, theme/tokens, environments) → M2 Core (auth/guest, room, preference) → M3 Map/Plan → M4 Active Date → M5 Retention (saved/review/push) → M6 Release. Chi tiết task: MOB-APPLY-001 → 011 trong tài liệu verification.

## Trạng thái

**Sprint 0 — skeleton.** Cấu trúc thư mục đã dựng theo tài liệu kiến trúc; chưa có code. `ios/`, `android/` sẽ được generate bằng Expo prebuild.
