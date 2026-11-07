import { queryOptions } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import type { OpResponse } from '@/shared/api/types'
import { loadAdministrativeSnapshot } from './snapshot'

export const administrativeVersionOptions = queryOptions({
  queryKey: ['administrative', 'version'],
  queryFn: () => api.get<OpResponse<'getAdministrativeVersion'>>('/administrative/version', { anonymous: true }),
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
})

export function administrativeUnitsOptions(version: string | undefined, provinceCode?: string) {
  return queryOptions({
    queryKey: ['administrative', version, provinceCode ?? 'provinces'],
    enabled: Boolean(version),
    staleTime: Infinity,
    gcTime: Infinity,
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
