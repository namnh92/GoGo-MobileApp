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
