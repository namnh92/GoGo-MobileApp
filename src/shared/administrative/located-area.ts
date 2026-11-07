import { api } from '@/shared/api/client'
import type { OpResponse } from '@/shared/api/types'

/** Coordinates and locate responses stay in the non-persisted Query cache. */
export function locatedAreaOptions(position: { lat: number; lng: number }) {
  return {
    queryKey: ['location', 'administrative-area', position.lat.toFixed(4), position.lng.toFixed(4)],
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    queryFn: () => api.get<OpResponse<'locateAdministrativeArea'>>('/administrative/locate', {
      query: { lat: position.lat, lng: position.lng }, anonymous: true,
    }),
  }
}
