import type { Plan, SavedEntry } from '@/shared/api'
import { discoveryMap } from '@/features/search/discovery-map'

/** Provider closures and moderation are independent of weekly opening hours. */
export function savedUnavailable(place: NonNullable<SavedEntry['place']>): string | null {
  if (['closed', 'temporarily_closed', 'moved'].includes(place.providerStatus?.status ?? '')) return place.providerStatus!.status
  if (['hidden', 'removed', 'rejected', 'archived'].includes(place.moderationStatus ?? '')) return 'unavailable'
  return null
}

export function savedGroupPins(entries: SavedEntry[]) {
  return discoveryMap({ status: 'ready', source: 'none', reason: 'no_area' }, entries.flatMap(entry => entry.type === 'place' && entry.place ? [entry.place] : [])).pins
}

export function orderedSavedStops(plan?: Plan) {
  return [...(plan?.stops ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

/** Straight-line estimate from a fresh GPS fix, never routed travel distance. */
export function savedDistance(place: { lat?: number; lng?: number }, position: { lat: number; lng: number } | null) {
  if (!position || place.lat == null || place.lng == null || ![position.lat, position.lng, place.lat, place.lng].every(Number.isFinite)
    || Math.abs(place.lat) > 90 || Math.abs(place.lng) > 180) return undefined
  const radians = Math.PI / 180
  const a = Math.sin((place.lat - position.lat) * radians / 2) ** 2
    + Math.cos(place.lat * radians) * Math.cos(position.lat * radians) * Math.sin((place.lng - position.lng) * radians / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}
