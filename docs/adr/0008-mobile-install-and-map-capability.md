# ADR 0008 — Installation state and native Maps capability

Status: accepted for implementation · 2026-09-09 · user-reported Mobile hardening (APP-010 #21)

## Context

Splash always reopened intro. Keychain credentials can survive iOS uninstall.
Android device log on 2026-09-09 at 18:28 reports `IllegalStateException: API key not found`
on `androidmapsapi-ula-1`. The local iOS binary lacks the Google Maps pod.
Notification preferences default to enabled server-side independently of OS permission.

## Decision

Persist an installation marker and intro completion in AsyncStorage, credentials only
in SecureStore. Before restoring credentials, absent marker clears the old session;
storage failure fails closed. Disable Android backup so a restored marker cannot
misrepresent a new installation. The first upgrade without a marker signs out once; the query cache buster also
discards cached account data from the previous build.
Ordinary launches restore the session and skip completed intro. Finish/skip intro
requests notification permission, superseding the previous preferences-only timing.
Location/photo permissions remain contextual. Push switches are off/disabled until OS
permission is granted, and permission is reread on focus and foreground. Email preferences
remain independent. Denial leads to one explicit Settings action, never another prompt.

Require both native Maps keys at config evaluation. iOS links Google through Expo's
existing plugin. Android reads a boolean from a small local Expo module before mounting
MapView; absence of the module or native key falls back to the caller's list/empty surface.
The adapter uses Google on both platforms and no longer silently selects Apple Maps.

## Alternatives

A JS try/catch cannot catch the Android SDK's fatal background-thread exception.
A Metro `extra` flag can drift from the installed APK. Both were rejected. The local
`GoGoMapCapability` module reads AndroidManifest metadata and returns only a boolean.
It adds no provider SDK, network call, personal data collection, or permission. It is
Android-only; no iOS privacy manifest is added. Maintain its compile settings alongside
the existing Expo local modules and rebuild after native changes.

Android atmosphere uses a static semantic-token gradient instead of the SDK 54 BlurView
solid white fallback. iOS keeps the existing appearance.

## Migration, verification, rollback

Fetch environment-specific SDK keys into ignored `.env.local`, prebuild both platforms,
install pods and rebuild. Android signing SHA-1 must be authorized by the configured key.
Test cold start, reopen, reinstall, intro completion, notification denial/grant/revocation,
and Google Maps on both OSs. Unit/component gates do not prove real basemap rendering.

Rollback by reverting this change and rebuilding; no backend/schema migration. Removing
the installation guard restores the prior credential policy; deleting the marker alone
intentionally signs out on the next launch. Do not roll back Android key configuration
without also restoring a safe map fallback.
