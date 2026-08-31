# ADR 0003 — `expo-location` for the origin of a search

Status: accepted · 2026-08-28

## Context

APP-005 asks for the location permission to be "asked in context with fallback
(manual area entry when location denied)". None of that existed. The create
flow's "Vị trí hiện tại" row was a constant:

```ts
const CURRENT_AREA = 'Thảo Điền, TP.HCM'
```

Tapping it set the room's area to that literal string and left `originLat` and
`originLng` null. So the row lied — it named a fixed Saigon neighbourhood and
called it the user's location — and it left the search without an origin, which
is what `sort=distance` needs. It is the same failure mode as a stock photo
standing in for a place: plausible enough to be believed, and wrong.

A new native module needs an ADR, so this is it.

## Decision

Add `expo-location`, behind `useCurrentLocation` in `src/shared/location/`.

- **Asked on tap, never on launch.** The permission dialog appears when the user
  taps the row, with a usage string that names the fallback: "Bạn có thể chọn
  khu vực thủ công thay vì cấp quyền."
- **Four outcomes, all handled.** `granted` fills in the coordinates and a
  reverse-geocoded area label; `denied` and `unavailable` both say so and open
  the area picker; `asking` shows a spinner and disables the row.
- **Coordinates are the fact, the label is decoration.** `originLat`/`originLng`
  go to the API; the label is display only, and no street address ever reaches
  it. There is no stable `areaKey` for a device fix, so it is set to null.
- **Balanced accuracy.** Places are ranked by area, not by metres. A coarser fix
  is faster and less invasive.

## Consequences

- The dev client must be rebuilt. `expo-location` throws "Cannot find native
  module 'ExpoLocation'" at *import* time on a binary built before it was added
  — confirmed on a simulator, where a static import took the whole screen down.
  It is therefore loaded through a lazy `require` inside a try/catch, and a
  binary without it degrades to `unavailable` instead of crashing.
  `location-module-missing.spec.tsx` pins that.
- `pnpm add expo-location` resolved 57.0.14, which targets a later SDK and ships
  no podspec, so autolinking silently produced a binary with no native module.
  `npx expo install` is the only correct way in: it picked 19.0.8 for SDK 54.
- Exact coordinates are subject to the retention rule in the security guidance.
  Nothing is cached locally beyond the room draft the user is building.
- Android needs the same rebuild. The plugin config declares foreground
  permission only — background location is explicitly disabled on both
  platforms.

## Verification

Driven on a simulator with a set location: the permission dialog appears with
the Vietnamese usage string, granting resolves the area into the row, and the
manual picker opens on refusal. Two bugs surfaced only there — the import-time
crash above, and a label that read "An Khanh, An Khanh" because the geocoder
returned the same name for district and city. Both are fixed and covered.
