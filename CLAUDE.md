# GoGo-MobileApp

React Native iOS/Android app for GoGo (couple/group date planning).

**Stack:** RN + TypeScript strict, Expo Dev Client (bare only if a native dep forces it), Expo Router/React Navigation per ADR, TanStack Query (server state) + Zustand (UI/workflow only), React Hook Form + Zod, Keychain/Keystore secure storage, native map adapter, APNs/FCM abstraction, crash reporting.

## Structure

`src/app/` (expo-router routes — thin `export { default } from '@/features/...'` re-exports only) · `src/features/<feature>/` (screen implementations) · `src/shared/{ui,api,storage,navigation,analytics,providers,i18n,store,pricing,config}` · `src/data/` (mock fixtures until the real API lands) · `ios/`, `android/` via Expo prebuild.

**Screen file convention (mandatory):** each screen/view = `<screen>.view.tsx` (component, no `StyleSheet.create`) + `<screen>.style.tsx` (exports `styles`) co-located in its feature folder. Inline styles only for dynamic values (animations, safe-area insets, interpolations). Shared primitives live in `src/shared/ui`.

## Hard rules

- TanStack Query owns server state; Zustand only drafts/flow/session flags — never duplicate server state long-term in a global store.
- API via generated OpenAPI client wrapper (`src/shared/api`) — never hand-copied types. Clients call only the BFF `/v1` contract.
- Deep links: `https://gogo.app/r/{inviteCode}`, `gogo://room/{inviteCode}`, `gogo://plans/{planId}`, `gogo://places/{placeId}`. Handle cold/warm start × logged-in/guest × expired invite × app-not-installed. Invite codes carry no PII.
- Permissions asked in context with fallback (manual area entry when location denied). Map/provider failure → List + external directions URL. Push is only a trigger — refetch from API on open.
- Offline: cache current plan + minimal place summaries for active date; drafts persisted with sync version; **purge room data cache on logout**.
- Tokens only in Keychain/Keystore; never in URLs or logs.
- Rooms support N members; audience copy from room facts (`type`, `participantCount`, `budgetMode`), not hardcoded couple strings. Money integer minor units.
- Locked stops survive regenerate; votes idempotent; member/guest cannot finalize plans (server-enforced — UI hiding is not authorization).
- Warm Liquid Glass semantic tokens only; solid fallback for glass; WCAG 2.2 AA; ≥44×44 targets; reduced motion respected; i18n keys (vi default, en); taxonomy = stable keys from API.
- Glass implementation: `@callstack/liquid-glass` (native iOS 26) behind the `GlassCard` adapter (`src/shared/ui/primitives.tsx`) and the floating tab dock (`src/app/(tabs)/_layout.tsx`), gated by `isLiquidGlassSupported` with translucent-solid fallback; atmosphere = color blobs + `expo-blur`; gradient CTAs = `expo-linear-gradient`; tab screens pad scroll content with `useTabDockInset()`.
- Every async screen: loading/empty/error/success + offline/permission-denied where relevant. New native module requires an ADR.

## Git

Git Flow: `master` (prod, tags `vX.Y.Z`) / `develop` / `feature|bugfix|hotfix/GOGO-<ticket>-<name>` / `release/x.y.z`. Conventional Commits. PRs only.

Workspace docs: `GOGO_SRS.md`, `GOGO_ENGINEERING_SKILLS_AND_PLANS.md`, `GOGO_MOCKUP_VERIFICATION_AND_TECHNICAL_APPLICATION-2.md` in the parent GoGo workspace.
