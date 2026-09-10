# Mobile hardening — 2026-09-09

Scope: APP-010 (#21), six user-reported startup/UI/Maps/notification issues.
Branch: `bugfix/GOGO-21-mobile-startup-permissions`. Changes are local, not merged.

## Evidence

- Android device crash buffer: `max.gogo.dev`, 18:28:13,
  `IllegalStateException: API key not found`, thread `androidmapsapi-ula-1`.
- Local build environment lacked both Maps keys; original iOS Podfile.lock had
  no `react-native-google-maps`. DEV client keys were loaded from the two declared
  SSM mobile paths into ignored `.env.local`; values were never printed.
- Expo prebuild completed for both platforms. CocoaPods installed Google Maps.
- Android `:app:assembleDebug`: BUILD SUCCESSFUL, including `gogo-map-capability`.
  Updated APK installed successfully on the connected Android test phone.
- Typecheck, lint, API schema drift check: passed.
- Vitest: 219 passed; 39 live contract cases skipped without a backend test run.
- Jest: 64 passed across 11 suites. Used `--forceExit` after completion because the
  existing suite retains open handles (tracked separately in #133).
- Notification preferences preload from Profile, render immediately from persisted
  cache, and update optimistically with rollback. On a first uncached load, all rows
  render immediately while their switches stay safely disabled until GET completes.

## Regression coverage

Session restoration with/without installation marker and unavailable storage;
concurrent hydration; intro completion despite notification denial; cold/warm
startup routing and waiting for session hydration; push disabled without consent;
refresh after Settings revocation; independent email preferences; immediate uncached
notification layout; absent map SDK, Android native key gating and iOS Google
provider/fallback.

## Device acceptance still required

The Android phone rendered the Google basemap, marker and Google attribution without
a crash. Cold start restored the existing session and skipped intro. Android gradient,
cards and tab dock were visually accepted after removing incompatible elevation from
translucent surfaces. No reinstall/wipe was performed on the phone. Reinstall and real
push delivery still need device acceptance. The first upgrade signs out once because
old builds have no installation marker.

The generic iOS Simulator build failed linking x86_64. A subsequent arm64 build
reached Expo Constants but the local `.env` no longer contained the OneSignal/Tenjin
values present at the start of the task. The current `.env` was preserved; the next
build uses public SDK configuration from the DEV APK built above. Missing settings
were subsequently restored into ignored `.env.local`, preserving `.env`. Do not treat pod installation or mocked provider selection as proof
of a rendered iOS Google Map.

SecureStore reinstall behavior is documented by Expo:
https://docs.expo.dev/versions/latest/sdk/securestore/


The iOS linker failure was traced to a local CocoaPods cache mismatch: installed
`React-Core-prebuilt` matched the Release tarball byte-for-byte while its configuration
marker was absent. React Native then assumed Debug and skipped replacement. The marker
was corrected to the observed Release state and the bundled replacement script restored
the cached Debug framework. No dependency versions or tracked Podfile were changed.

Final iOS result: arm64 iPhone Simulator Debug build completed with exit 0 after
cache repair, using GoogleMaps 8.4.0 and react-native-google-maps 1.20.1. Native
compilation is verified on both platforms. The user confirmed the physical iOS build
renders Google Maps. Reinstall behavior and real notification delivery remain device
acceptance items.
