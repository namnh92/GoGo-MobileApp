import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { regionForPins, type MapPin } from '@/shared/ui/map-region'

type PlacePosition = { id: string; name: string; lat?: number | null; lng?: number | null }

/** One marker, at the camera centre: device for GPS, otherwise the top-1 place.
 * Never replace a top-1 without coordinates with a lower-ranked result. */
export function discoveryMap(scope: DiscoveryScope, places: PlacePosition[], currentLocationTitle: string) {
  const top = places[0]
  const pins: MapPin[] = scope.status === 'ready' && scope.source === 'gps'
    ? [{ id: 'discovery-current-location', ...scope.position, title: currentLocationTitle }]
    : top?.lat != null && top.lng != null && Number.isFinite(top.lat) && Number.isFinite(top.lng)
      ? [{ id: top.id, lat: top.lat, lng: top.lng, title: top.name }] : []
  return { pins, region: regionForPins(pins) }
}
