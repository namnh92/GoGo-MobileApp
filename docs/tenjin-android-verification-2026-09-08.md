# Android Tenjin native repair — 2026-09-08

Local branch: `bugfix/GOGO-56-tenjin-android-native`, based on `origin/develop`.
Related backlog: #56. Not merged or published.

## Before

Physical Android, package `max.gogo.dev`, Tenjin Android SDK 1.23.0.
Google Play Services was installed, but the APK's DEX class definitions did
not contain `AdvertisingIdClient` or `AppSet`. `AD_ID` was absent.
At 15:42:59 device log time, Tenjin returned:

```json
{"code":202,"message":"invalid device identifier"}
```

The same process logged failure invoking `getAdvertisingIdInfo` and
`advertising_id=null`. No raw identifiers or SDK keys are retained here.

## Repair and verification

- Expo plugin adds the three documented native libraries, `AD_ID`, network
  permissions and `TENJIN_APP_STORE=googleplay` for all Android flavors.
- Repeated Android prebuild succeeds; each dependency, permission and store
  declaration occurs once.
- Lint, TypeScript and diff whitespace check pass.
- Vitest: 206 passed, 39 skipped (including opt-in contract tests).
- Jest: 53 passed across 9 suites. Jest reports a worker teardown
  warning; this does not establish native provider success.
- Gradle `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a` succeeds.
- Actual APK DEX definitions contain `AdvertisingIdClient`, `AppSet`,
  `InstallReferrerClient`, and `TenjinSDK`.
- `adb install -r` succeeds on the connected physical phone, preserving app data.
- Installed package reports `AD_ID: granted=true`.

## Runtime connect accepted on the physical phone

After the user unlocked the phone, USB reverse forwarding had to be restored.
The app was restarted and loaded the Metro bundle. At 17:45:14.825 device log
time, the new app process reported `bundle_id=max.gogo.dev`, SDK 1.23.0,
a non-null, non-zero Advertising ID (value deliberately withheld), and:

```json
{"code":200}
```

This verifies a successful real Tenjin connect response after the native fix,
replacing the previous `202: invalid device identifier`. Dashboard status has
not been independently inspected. Store-install attribution/deferred-link
navigation is separate and is not claimed by this repair.

Metro runs on localhost:8081 with USB reverse forwarding for the installed
DEV client. Rebuild the binary when changing native configuration.
