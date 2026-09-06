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

CI config resolution uses explicit non-live fixture IDs/keys. Native app builds
must use environment-scoped real values from the Infra exporters. No mock
provider or environment-dependent behavior is introduced into the app.
