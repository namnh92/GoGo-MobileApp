# ADR 0007: Tenjin native acquisition bootstrap

Accepted for GoGo-MobileApp#56. Use the official react-native-tenjin 1.6.0 module
in Expo Dev Client with native autolinking. Each build requires its own iOS and
Android public SDK keys and an environment marker matching the app flavor.
DEV, staging and production use identical initialization and validation.

Initialize and connect once on native startup. Synchronous provider failure emits
only `acquisition_sdk_unavailable` and does not block app startup. Do not attach GoGo user identity,
tokens, product events or navigation to this bootstrap. No advertising permission
prompt is introduced. Navigation continues through GoGo's existing link router.

This change establishes SDK wiring, not deferred-link acceptance. Tracking
templates, store listings, the canonical backend resolver (GoGo-BE#205), and
pending-link routing must be verified before claiming install-to-destination
delivery. Store URLs are intentionally absent until the apps exist in the stores.

Rollback: remove the bootstrap call and native dependency, rebuild the binary;
direct GoGo links remain independent of Tenjin.

## Verification and build procedure

Use a fresh generated native project (`expo prebuild --clean --no-install` on a
checkout with no hand-maintained native files), then `pod install`. Running the
OneSignal 2.7.1 plugin repeatedly against the same generated Xcode project can
create duplicate NotificationService.swift build references; CocoaPods then
rejects the project. A fresh prebuild plus pod install was verified successfully.
Resolved iOS SDKs: OneSignalXCFramework 5.5.6 and TenjinSDK 1.19.0.

## Android native dependencies — 2026-09-08

A physical Android DEV install contained Tenjin 1.23.0 but no
`AdvertisingIdClient` or AppSet API class. Google Play Services was installed;
the app could not call it. Connect returned `code: 202`, `invalid device
identifier`. This is a native packaging defect, independent of SDK keys and
store listings.

Use `plugins/with-tenjin-android.js` to include Google Advertising ID 18.3.0,
AppSet ID 16.1.0 and Play Install Referrer 2.2, declare `AD_ID` and network
permissions, and set `TENJIN_APP_STORE=googleplay`. These are the dependencies
documented by the existing Tenjin provider, not a new analytics provider.
The RN wrapper does not include them itself. A generated-native-file edit
would disappear on clean prebuild; upgrading the wrapper alone does not add
these application dependencies.

Privacy: identifiers remain inside the acquisition SDK; do not log identifiers
or keys, attach GoGo identity, or override the user's advertising-ID settings.
No runtime permission dialog or iOS ATT change is introduced. Android's `AD_ID`
is a manifest permission. AppSet ID is a separate app-scoped identifier, not an
advertising ID. Store privacy declarations must describe the identifiers used
by the SDK before publishing.

Maintain pinned versions in this plugin and verify generated manifest, runtime
classpath and a real connect response when upgrading Expo or Tenjin. Rebuild
the native binary to apply this change; Metro reload alone is insufficient.
Rollback: remove the plugin registration and rebuild Android. iOS is unchanged.

Reference: https://github.com/tenjin/tenjin-android-sdk#play-services-ads-identifier-google-play

CI config resolution uses explicit non-live fixture IDs/keys. Native app builds
must use environment-scoped real values from the Infra exporters. No mock
provider or environment-dependent behavior is introduced into the app.
