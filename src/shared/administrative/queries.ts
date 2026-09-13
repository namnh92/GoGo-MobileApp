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
