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
  missed. "Over" is a terminal state only (no ATT, iOS already answered, an
  answer, or "Để sau") — no clock: a timeout would let the deferred link open
  and then the sheet appear on top of it. The gate reaches a terminal state as
  soon as someone is on a main screen.
- **The moment:** the splash lifted, the app active, a session, a screen past
  sign-in and onboarding. If the moment ends before an answer (session ends,
  app backgrounded), the sheet is taken down and asked again at the next one;
  the system dialog, once up, is left to finish.
- **iOS only, explicitly:** the library's `isAvailable()` is true on Android
  (the native module exists and answers `granted`), so availability is
  `Platform.OS === 'ios'` and the module.
- **Diagnostics:** `consent_tracking:<status>` reason codes go to the device
  log in release builds too; device acceptance reads them.
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

Removing the prompt does not take back consent already given: iOS keeps the
"Allow" of everyone who answered it, and any MMP SDK still in the binary keeps
reading the IDFA for them. So the declaration does **not** go back with the
code.

1. Code: remove the plugin entry, `locales`, `src/shared/consent/*`, the gate
   from the root layout and the resumer's wait on `trackingConsent.settled()`;
   drop the dependency; rebuild.
2. Declaration: keep `docs/store-privacy.md` §12 D-6 (tracking = có) for as
   long as any SDK that reads the IDFA ships (Tenjin today, Adjust after #367).
   Restoring D-1 needs those SDKs removed or their IDFA reading disabled, and
   that verified in the Xcode privacy report of the build being submitted.
3. Record: mark this ADR withdrawn with the date and the owner decision, and add
   a dated line to `docs/store-privacy.md` §12.
