/** A pin the map adapter can place. */
export interface MapPin {
  id: string
  lat: number
  lng: number
  title: string
  /** Rendered in place of the default pin — a price bubble, a closed marker. */
  content?: unknown
  selected?: boolean
}

/** Latitude/longitude bounds that fit every pin, with a little air around them. */
export function regionForPins(pins: MapPin[]) {
  if (pins.length === 0) return null
  const lats = pins.map(pin => pin.lat)
  const lngs = pins.map(pin => pin.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // A single pin has no spread, so fall back to a neighbourhood-sized window.
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
  }
}
