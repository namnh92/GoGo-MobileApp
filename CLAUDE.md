# GoGo-MobileApp

React Native iOS/Android app for GoGo (couple/group date planning).

**Stack:** RN + TypeScript strict, Expo Dev Client + New Architecture (bare only if a native dep forces it), Expo Router, TanStack Query (server state) + Zustand (UI/workflow only), Keychain/Keystore secure storage, native map adapter, APNs/FCM abstraction, crash reporting.

## Approved libraries (alternatives need an ADR)

| Concern | Library | Status |
| --- | --- | --- |
| Theme, tokens, variants | `react-native-unistyles` 3.2.5 + `react-native-nitro-modules` 0.36.1 (pinned) | Chốt — installed (ADR-0009): four accent themes in `src/shared/ui/theme.ts`, config in `src/shared/ui/unistyles.ts` (loaded from `index.ts`); migrate `.style.tsx` incrementally, keep the `.view/.style` split |
| Form state | `react-hook-form` (`Controller`, `useWatch`) | Chốt |
| Runtime validation | `zod` + `@hookform/resolvers` (`zodResolver`) | Chốt — one schema shared by forms and API-response validation |
| Animation foundation | `react-native-reanimated` v4 (+`react-native-worklets`) | Chốt — installed |
| Gesture | `react-native-gesture-handler` | Chốt — installed; migrate PanResponder usages when touched |
| Simple mount/unmount | `moti` | Optional — compatibility spike vs Reanimated 4 first |
| Blur / glass | `@callstack/liquid-glass` + `expo-blur` | Chốt — installed |
| Gradient | `expo-linear-gradient` | Chốt — installed |

## Structure

`src/app/` (expo-router routes — thin `export { default } from '@/features/...'` re-exports only) · `src/features/<feature>/` (screen implementations) · `src/shared/{ui,api,storage,navigation,analytics,providers,i18n,store,pricing,config}` · `src/data/` (mock fixtures until the real API lands) · `ios/`, `android/` via Expo prebuild.

**Screen file convention (mandatory):** each screen/view = `<screen>.view.tsx` (component, no `StyleSheet.create`) + `<screen>.style.tsx` (exports `styles`) co-located in its feature folder. Inline styles only for dynamic values (animations, safe-area insets, interpolations). Shared primitives live in `src/shared/ui`.

## Hard rules

- TanStack Query owns server state; Zustand only drafts/flow/session flags — never duplicate server state long-term in a global store.
- API via generated OpenAPI client wrapper (`src/shared/api`) — never hand-copied types. Clients call only the BFF `/v1` contract.
- **Flavours:** `EXPO_PUBLIC_ENV` (`dev` | `stag` | `prod`) drives bundle id `max.gogo.{flavor}`, app name and scheme from `app.config.ts` — the single source, since `ios/`/`android/` are prebuild output. One vocabulary: the same token the running app validates in `env.ts`. An unknown value (including a spelled-out `production`) fails the build rather than defaulting.
- Deep links: `https://{webHost}/l/{slug}` and `/r/{inviteCode}`, where `webHost` is the flavour's share host from `app.config.ts` (`go-dev` / `go-stag` / `go.gogo.id.vn` — the owned domain). **`dev` and `prod` claim theirs; `stag` stays unclaimed until its host serves the association files** — a build claiming a host whose `apple-app-site-association` / `assetlinks.json` never names it can never verify. Scheme links: `gogo://room/{inviteCode}`, `gogo://plans/{planId}`, `gogo://places/{placeId}`; dev/stag use `gogo-dev://` / `gogo-stag://`. Handle cold/warm start × logged-in/guest × expired invite × app-not-installed. Invite codes carry no PII.
- Permissions asked in context with fallback (manual area entry when location denied). Map/provider failure → List + external directions URL. Push is only a trigger — refetch from API on open.
- Offline: cache current plan + minimal place summaries for active date; drafts persisted with sync version; **purge room data cache on logout**.
- Tokens only in Keychain/Keystore; never in URLs or logs.
- Rooms support N members; audience copy from room facts (`type`, `participantCount`, `budgetMode`), not hardcoded couple strings. Money integer minor units.
- Locked stops survive regenerate; votes idempotent; member/guest cannot finalize plans (server-enforced — UI hiding is not authorization).
- Warm Liquid Glass semantic tokens only; solid fallback for glass; WCAG 2.2 AA; ≥44×44 targets; reduced motion respected; i18n keys (vi default, en); taxonomy = stable keys from API.
- Surfaces (#295): cards are solid — `Card` (`src/shared/ui/card.view.tsx`); `GlassCard` is a deprecated unpadded alias until #298. The screen canvas (`Atmosphere`) is flat `surface.canvas`. Glass (`@callstack/liquid-glass`, iOS 26, gated by `isLiquidGlassSupported`, `expo-blur` fallback) is only for the tab dock and fixed bottom bars (#296). CTAs are flat `accent.primary`; `expo-linear-gradient` survives only in `swipe.view`. Tab screens pad scroll content with `useTabDockInset()`.
- Every async screen: loading/empty/error/success + offline/permission-denied where relevant. New native module requires an ADR.

## Git

Git Flow: `master` (prod, tags `vX.Y.Z`) / `develop` / `feature|bugfix|hotfix/GOGO-<ticket>-<name>` / `release/x.y.z`. Conventional Commits. PRs only.

Workspace docs: `GOGO_SRS.md`, `GOGO_ENGINEERING_SKILLS_AND_PLANS.md`, `GOGO_MOCKUP_VERIFICATION_AND_TECHNICAL_APPLICATION-2.md` in the parent GoGo workspace.
