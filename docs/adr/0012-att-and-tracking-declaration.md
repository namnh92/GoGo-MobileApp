# ADR 0012: App Tracking Transparency and the tracking declaration

Accepted for GoGo-MobileApp#366 (MMP-APP-003, epic #363). Shape:
`dev/handoffs/sa-shape-mobile-363-adjust.fable.rev2.md` D5 (workspace). Owner
decisions 2026-10-19 (workspace `.claude/rules/execution-policy.md` §8): Q1 (b)
ask for ATT and declare tracking; Q8 (a) Tenjin keeps `connect()` at startup.
Supersedes the "no advertising permission prompt" line of ADR 0007 and
`docs/store-privacy.md` §12 D-1.

## Context

Until now the app never asked iOS for tracking permission, so the IDFA was
zero and Tenjin attributed iOS installs from IDFV and IP. The store declaration
said "not used to track" while D-1 recorded the risk that IP plus device
signals is fingerprinting under Apple's ATT guidance. With a second MMP
(Adjust, #367) planned and paid campaigns expected, the owner chose the
Apple-accepted path: ask first, then declare tracking.

## Decision

- **Library:** `expo-tracking-transparency` 6.0.8, pinned (the Expo SDK 54
  bundled version). First-party Expo module; its config plugin writes
  `NSUserTrackingUsageDescription` and gives status + request + `isAvailable()`.
  Rejected: Adjust's `requestAppTrackingAuthorization` (ties OS consent to one
  vendor, no status outside it, no plist string); `react-native-tracking-transparency`
  (community, no config plugin).
- **One owner module:** `src/shared/consent/tracking.ts` is the only importer
  (test-pinned). The app never reads the IDFA; each MMP SDK reads it once iOS
  allows it.
- **When:** a GoGo sheet (`tracking-sheet.view.tsx`) explains first, then the
  system dialog. Once per launch, iOS only, only while iOS has no answer, on the
  first screen after a user or guest session — never on the splash, sign-in or
  onboarding (`tracking-consent-gate.tsx`). "Để sau" closes it without asking
  iOS; it returns next launch. No feature is gated on the answer (App Review
  5.1.2(i)); the sheet never mimics the system dialog nor rewards "Allow".
- **Words:** owner-approved 2026-10-19 (#366), vi default and en, in the plugin
  option, `locales/vi.json`, `locales/en.json` and i18n key
  `consent.tracking.systemPrompt` — one test keeps all four equal. Both
  languages ship because an `en.lproj` alone would be picked for Vietnamese
  devices too.
- **Deferred links:** the resume (#364) also waits for this launch's consent
  question to be over, so an MMP holding its report until the answer is not
  missed; a 120 s bound stops a sheet that never shows from holding it.
- **Tenjin:** the RN wrapper has no ATT API and `connect()` stays at startup
  (Q8 (a)), so the install session carries IDFA zero and Tenjin receives the
  IDFA from the next launch after consent.
- **Android:** unchanged. No ATT exists; GAID needs only `AD_ID`, already
  declared (the plugin adds the same permission; the manifest merge dedupes).

## Consequences

- App Store label: `Identifiers · Device ID` and `Usage Data · Advertising
  Data` are declared as used to track (`docs/store-privacy.md` §6, §12 D-6).
- Each store submission re-reads the SDKs' bundled privacy manifests and the
  Xcode privacy report (`docs/store-privacy.md` §11 step 5).
- Consent rate is unknown; iOS attribution quality depends on it.
- Open legal question: whether Vietnam's Decree 13/2023 requires consent for
  device identifiers on Android as well.

## Rollback

Remove the plugin entry, `locales`, `src/shared/consent/*` and the gate from
the root layout, drop the dependency, rebuild the binary, and restore D-1 in
`docs/store-privacy.md`. A person who already allowed tracking keeps that
setting in iOS; without the plist string the app simply never asks again.
