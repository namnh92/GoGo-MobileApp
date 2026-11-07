import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { regionForPins, type MapPin } from '@/shared/ui/map-region'

type PlacePosition = { id: string; name: string; lat?: number | null; lng?: number | null }

function usable(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** All loaded results are markers; the camera follows GPS or the top-ranked place. */
export function discoveryMap(scope: DiscoveryScope, places: PlacePosition[]) {
  const pins: MapPin[] = places.filter(place => usable(place.lat, place.lng))
    .map(place => ({ id: place.id, title: place.name, lat: place.lat!, lng: place.lng! }))
  const top = places[0]
  const gps = scope.status === 'ready' && scope.source === 'gps' && usable(scope.position.lat, scope.position.lng)
    ? scope.position : null
  const camera = gps ? [{ id: 'camera', title: '', ...gps }]
    : top && usable(top.lat, top.lng) ? [{ id: top.id, title: top.name, lat: top.lat!, lng: top.lng! }] : pins
  return { pins, region: regionForPins(camera), showsUserLocation: gps !== null }
}

/** A circle covering the viewport corners, within /places/search's 100 km cap. */
export function viewportSearchScope(region: NonNullable<ReturnType<typeof regionForPins>>) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region
  if (![latitude, longitude, latitudeDelta, longitudeDelta].every(Number.isFinite)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || latitudeDelta <= 0 || longitudeDelta <= 0) return null
  const radians = Math.PI / 180
  const distance = (lat: number) => {
    const dLat = (lat - latitude) * radians
    const dLng = Math.min(longitudeDelta / 2, 180) * radians
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * radians) * Math.cos(lat * radians) * Math.sin(dLng / 2) ** 2
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
  }
  return {
    lat: latitude, lng: longitude,
    radiusM: Math.min(100000, Math.max(100, Math.ceil(Math.max(
      distance(Math.min(90, latitude + latitudeDelta / 2)),
      distance(Math.max(-90, latitude - latitudeDelta / 2)),
    )))),
  }
}
