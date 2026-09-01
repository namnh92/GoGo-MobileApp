# ADR 0005 — Google Maps on iOS

Status: accepted · 2026-09-01 · amends ADR 0004 (iOS provider)

## Context

ADR 0004 put `react-native-maps` behind `MapCanvas` and took Apple Maps on iOS
because it needs no key and no account. That got a real map on screen quickly,
and it remains the right fallback. It is the wrong default.

Every place in GoGo comes from Google. The catalog is resolved through Google
Places, a user adds a café by pasting a Google Maps link (FR-PLACE-001), and
"Chỉ đường" opens Google Maps (FR-PLAN-010). On Apple Maps the same café can
carry another name, sit on a differently named street, or be missing from the
basemap altogether — so a pin GoGo placed from Google coordinates lands on a map
that disagrees with it. One place, two maps.

Android already renders Google (it is `react-native-maps`' only Android
provider) once its key exists. iOS should match.

## Options

1. **Google Maps on iOS through `react-native-maps`.** The library ships
   `react-native-google-maps.podspec` (GoogleMaps 8.4.0, Google-Maps-iOS-Utils
   5.0.0), and Expo's built-in config plugin wires all of it from one config
   value. Needs a Maps SDK for iOS key, which lives in the binary.
2. **Keep Apple Maps.** No key, no pod, and the mismatch above stays.
3. **`expo-maps`.** Apple + Google, still moving in SDK 54. Swapping the
   adapter's SDK is a separate decision, not this one.

## Decision

Option 1, from one input: `GOOGLE_MAPS_IOS_API_KEY` in `.env` at prebuild.
`app.config.ts` passes it as `ios.config.googleMapsApiKey`; Expo's
`react-native-maps` plugin then adds `GMSApiKey` to Info.plist, the
`react-native-google-maps` pod to the Podfile and `GMSServices.provideAPIKey`
to the AppDelegate. Without the key the plugin adds none of that, and the binary
is exactly what ADR 0004 built.

The runtime reads neither the key, nor a flag, nor the manifest. `MapCanvas`
asks the binary whether it linked Google — `UIManager.hasViewManagerConfig
('AIRGoogleMap')`, the probe `react-native-maps` itself gates on — and passes
`PROVIDER_GOOGLE` only then. Two reasons:

- Asking for Google on a binary without the pod renders the library's
  "AirGoogleMaps dir must be added" placeholder, not a map. Whatever decides
  has to be true of *this* binary.
- A manifest flag is evaluated by the dev server from whatever `.env` it was
  started with; the binary was built from the `.env` at prebuild. The two drift
  the moment someone edits the key without rebuilding. A binary cannot lie
  about its own pods.

`extra` carries nothing about maps. Expo strips `ios.config` from the manifest,
so the key never reaches JavaScript, and the variable is deliberately not
`EXPO_PUBLIC_*`, so it is never inlined into the bundle either.

## Consequences

- **The key ships in the binary.** That is how Google's SDK works; a client map
  has no server-side hop. The protection is on Google's side: the key is
  restricted to the Maps SDK for iOS and to the bundle ids `max.gogo.dev` /
  `max.gogo.stag` / `max.gogo.prod` (GoGo-Infra#101, INF-055). It is never
  committed; `.env.example` carries an empty line.
- **Changing the key means rebuilding:** `npx expo prebuild --platform ios &&
  pnpm ios`. `expo run:ios` does not re-run prebuild over an existing `ios/`.
- **Two map SDKs on iOS.** Apple Maps stays linked (the `react-native-maps`
  base); Google is added. GoogleMaps 8.4.0 is pinned by the library and ships a
  privacy manifest (added in 8.4.0), which Expo's
  `privacy_file_aggregation_enabled` folds into the app's.
- **Cost.** Dynamic Maps on mobile bills per map load past the free tier; the
  quota alert is part of GoGo-Infra#101.
- `toolbarEnabled` is Android-only and stays as is; `initialRegion`, markers
  with custom `content` and `tracksViewChanges` behave the same on the Google
  provider.
- Android is unchanged: still Google, still waiting on its own key (ADR 0004).

## Migration and rollback

Migration is the one variable. Rollback is removing it and rebuilding: the
plugin deletes its three blocks when the key is absent, `pod install` drops the
Google pods, `MapCanvas` finds no `AIRGoogleMap` and renders Apple Maps. No code
change in either direction.

## Verification

- `pnpm test`: `app.config.ts` with the variable → `ios.config.googleMapsApiKey`;
  without it, or blank → no `ios.config`; the key never appears in `extra`.
- `pnpm test:ui`: `MapCanvas` passes `PROVIDER_GOOGLE` when the binary reports
  `AIRGoogleMap`, `PROVIDER_DEFAULT` otherwise.
- Compile check with a placeholder key (see the PR): prebuild wrote the three
  blocks, `pod install` resolved GoogleMaps 8.4.0, the Debug simulator build
  linked. Rendering with a real key waits on GoGo-Infra#101.
