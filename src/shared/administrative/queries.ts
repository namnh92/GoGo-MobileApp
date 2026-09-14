import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import type { OpResponse } from '@/shared/api/types'
import { loadAdministrativeSnapshot } from './snapshot'

export function useAdministrativeVersion() {
  return useQuery({
    queryKey: ['administrative', 'version'],
    queryFn: () => api.get<OpResponse<'getAdministrativeVersion'>>('/administrative/version', { anonymous: true }),
    staleTime: 5 * 60_000,
  })
}

export function useAdministrativeUnits(version: string | undefined, provinceCode?: string) {
  return useQuery({
    queryKey: ['administrative', version, provinceCode ?? 'provinces'],
    enabled: Boolean(version),
    staleTime: Infinity,
    queryFn: () => loadAdministrativeSnapshot(version!, provinceCode, cursor =>
      provinceCode
        ? api.get<OpResponse<'listAdministrativeCommunes'>>('/administrative/provinces/{provinceCode}/communes', {
            pathParams: { provinceCode }, query: { limit: 100, ...(cursor ? { cursor } : {}) }, anonymous: true,
          })
        : api.get<OpResponse<'listAdministrativeProvinces'>>('/administrative/provinces', {
            query: { limit: 100, ...(cursor ? { cursor } : {}) }, anonymous: true,
          }),
    ),
  })
}

/**
 * ADM-205 (#214) — the commune or province containing a position. Keyed under
 * `location`, which is not a persisted query prefix: a position is never
 * written to storage, and the answer lives in memory for a few minutes only.
 */
export function useLocatedArea(position: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ['location', 'administrative-area', position?.lat.toFixed(4) ?? null, position?.lng.toFixed(4) ?? null],
    enabled: position !== null,
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    queryFn: () =>
      api.get<OpResponse<'locateAdministrativeArea'>>('/administrative/locate', {
        query: { lat: position!.lat, lng: position!.lng },
        anonymous: true,
      }),
  })
}
