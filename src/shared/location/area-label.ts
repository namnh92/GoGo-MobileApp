/** The parts of a reverse-geocode result this app is willing to display. */
export interface ReverseGeocodedPlace {
  district?: string | null
  subregion?: string | null
  city?: string | null
  region?: string | null
}

/**
 * A place label good enough to show, built from the finer part first so it
 * reads like an area ("Thảo Điền, TP.HCM") rather than a street address. The
 * coordinates remain the fact sent to the API; this string is display only, and
 * a street address is never part of it.
 */
export function areaLabelFrom(place: ReverseGeocodedPlace | undefined): string | null {
  if (!place) return null
  const parts = [place.district ?? place.subregion, place.city ?? place.region].filter(
    (part): part is string => Boolean(part),
  )
  // Some results name the district and the city identically ("An Khanh, An
  // Khanh" on a simulator fix in Thủ Đức); showing it twice reads as a bug.
  const unique = parts.filter((part, index) => parts.indexOf(part) === index)
  return unique.length > 0 ? unique.join(', ') : null
}
