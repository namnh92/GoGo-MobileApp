import { Linking } from 'react-native'

// Directions hand off to Google Maps via the universal directions URL: the
// Google Maps app claims it when installed, web maps otherwise — no native
// scheme allowlist (LSApplicationQueriesSchemes) or rebuild needed.
export function openGoogleMapsDirections(destination: string): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
  Linking.openURL(url).catch(() => {
    // Browser/app hand-off failed (no handler) — nothing actionable in-app.
  })
}
