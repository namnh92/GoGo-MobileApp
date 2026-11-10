import { useQuery } from '@tanstack/react-query'

import { administrativeUnitsOptions } from '@/shared/administrative/query-options'
import { administrativeAreaLabel } from '@/shared/administrative/snapshot'
import type { components } from '@/shared/api/types'

import { proposalRows, type ProposalValueLike, type RowContext } from './proposal-rows'

function readArea(value: unknown): components['schemas']['AdministrativeAreaInput'] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const area = value as Record<string, unknown>
  if (typeof area.datasetVersion !== 'string' || !area.datasetVersion ||
    typeof area.provinceCode !== 'string' || !area.provinceCode ||
    !(area.communeCode == null || typeof area.communeCode === 'string' && area.communeCode !== '')) return undefined
  return { datasetVersion: area.datasetVersion, provinceCode: area.provinceCode, communeCode: area.communeCode ?? null }
}

/** The existing snapshot loader checks dataset version and administrative hierarchy.
 * Codes are reused across versions, so never display a name from a newer dataset.
 */
export function useProposalRows(values: ProposalValueLike[], context: RowContext) {
  const area = readArea(values.find(value => value.field === 'administrativeArea')?.value)
  const provinces = useQuery(administrativeUnitsOptions(area?.datasetVersion))
  const communes = useQuery(administrativeUnitsOptions(area?.communeCode ? area.datasetVersion : undefined, area?.provinceCode))
  const province = provinces.data?.find(unit => unit.code === area?.provinceCode)
  const commune = communes.data?.find(unit => unit.code === area?.communeCode)
  const resolved = province && (!area?.communeCode || commune)
    ? administrativeAreaLabel({ provinceName: province.fullName, communeName: commune?.fullName ?? null })
    : undefined
  const loading = area && (provinces.isPending && !provinces.isPaused || area.communeCode && communes.isPending && !communes.isPaused)
  const failed = provinces.isError || communes.isError || provinces.isPaused || communes.isPaused
  return proposalRows(values, {
    ...context,
    administrativeAreaLabel: resolved ?? context.t(loading && !failed ? 'assistant.value.areaLoading' : 'assistant.value.areaUnavailable'),
  })
}
