# ADR 0006 — OneSignal native bootstrap (NTF-APP-001)

Status: implementation of the accepted OneSignal provider decision.

Use react-native-onesignal 5.5.9 and onesignal-expo-plugin 2.7.1 with Expo 54
Dev Client. The plugin is first in the CNG array and generates the iOS service
extension/APNs entitlement. Every flavor requires the same App ID, environment
marker and explicit APNs signing mode. No development bypass or default App ID.
Only the public App ID enters Expo extra; REST/signing keys remain server-side.
Privacy: logging and SDK location sharing disabled, no launch permission prompt.

This change initializes the SDK only. Identity binding, contextual permission
and routing remain the separate NTF-APP tasks. Current wrapper login accepts no
JWT. Do not silently weaken identity verification to activate named-user push.
The backend must provide the authenticated JWT and a supported native bridge or
wrapper must pass it to the underlying iOS/Android SDK before that phase.

Maintain pinned SDK/plugin versions and verify both native builds when updating.
Rollback: revert this commit and rebuild the binary; do not revoke provider keys
or change OneSignal dashboard enforcement as a side effect. Existing binaries
keep their native configuration until upgraded.

Sources checked 2026-09-05:
- https://documentation.onesignal.com/docs/en/identity-verification
- https://github.com/OneSignal/onesignal-expo-plugin
