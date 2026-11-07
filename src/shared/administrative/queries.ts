import { useQuery } from '@tanstack/react-query'
import { administrativeUnitsOptions, administrativeVersionOptions } from './query-options'

export function useAdministrativeVersion(options?: { enabled?: boolean }) {
  return useQuery({
    ...administrativeVersionOptions,
    // Startup owns the automatic check; consumers observe it and may retry explicitly.
    enabled: options?.enabled ?? false,
  })
}

export function useAdministrativeUnits(version: string | undefined, provinceCode?: string) {
  return useQuery(administrativeUnitsOptions(version, provinceCode))
}
