# ADR 0004 — `react-native-maps` behind a `MapCanvas` adapter

Status: accepted · 2026-08-28

## Context

The Saved tab shipped a List/Map toggle whose map was a coloured rectangle with
pins absolutely positioned on it. The pins were projected from real coordinates,
so their relative geometry was true, but there was no basemap: no streets, no
names, nothing to locate a place against. The active-date screen was worse — a
strip captioned "Xem bản đồ" that showed no map and opened nothing.

Both were placeholders with an honest comment in the source and a dishonest
surface in the app. A user reading "Bản đồ" reasonably expects a map.

The release gate also names it: "List/Map share filter and navigation state."

## Options

1. **`react-native-maps`.** Mature, the de-facto choice. Apple Maps on iOS with
   no key or account. Google Maps on Android, which needs an API key.
2. **`expo-maps`.** Expo's own, Apple Maps + Google Maps, still young for
   SDK 54 and its API is moving.
3. **A web map in a WebView.** No native module, but a worse map, a second
   untrusted surface to police, and no offline story.
4. **Keep the placeholder.** Cheapest, but leaves a screen that lies.

## Decision

Option 1, behind `MapCanvas` in `src/shared/ui/map-canvas.view.tsx`. That module
is the only file that knows a map SDK exists; callers pass pins and get a
`onSelect` callback. Swapping SDKs later is one file.

The adapter loads `react-native-maps` through a lazy `require` in a try/catch,
the same shape ADR 0003 settled on for `expo-location` — a native module missing
from the running binary throws at import time and would take the screen down.
Missing map means a plain surface, an honest line of copy, and a button back to
the list, which shows the same places.

## Consequences

- iOS works as soon as the dev client is rebuilt; Apple Maps needs no key.
- **Android is blocked on a Google Maps API key.** Until one exists in the
  secret store and reaches `android.config.googleMaps.apiKey`, Android renders
  the fallback. That is the reason the fallback is a real design and not a
  console warning.
- Markers render the default pin for now. Price bubbles and open/closed styling
  are supported by the `content` prop but not yet used; the previous
  implementation's bubbles depended on absolute positioning that a real map does
  not give us for free.
- The Saved map no longer needs `projectMarkers`, and the marker styles that
  went with it are gone.
- One more native module means one more rebuild for anyone pulling this branch.

## Verification

Rebuilt the iOS dev client and exercised both screens on a simulator. Pending at
the time of writing: confirming the Android fallback on an emulator, which needs
an Android build this session has not run.
