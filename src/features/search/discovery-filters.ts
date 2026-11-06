import type { PlaceSearchQuery } from '@/shared/api/endpoints/places'

/** CSV dimensions follow BE semantics: ALL amenities; OR within other groups. */
export interface DiscoveryFilters {
  categories: string[]
  priceFrom: string
  priceTo: string
  suited: string[]
  amenities: string[]
  moods: string[]
  settings: string[]
  openNow: boolean
}
export const emptyFilters = (): DiscoveryFilters => ({ categories: [], priceFrom: '', priceTo: '', suited: [], amenities: [], moods: [], settings: [], openNow: false })
function price(value: string): number | undefined {
  if (!value.trim()) return undefined
  return Number(value.replace(',', '.'))
}
export function validateFilters(filters: DiscoveryFilters): boolean {
  const min = price(filters.priceFrom)
  const max = price(filters.priceTo)
  return [filters.categories, filters.suited, filters.amenities, filters.moods, filters.settings].every(keys => new Set(keys).size <= 10) && [min, max].every(value => value === undefined || (Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 1000)))) && (min === undefined || max === undefined || min <= max)
}
export function filterParams(filters: DiscoveryFilters): PlaceSearchQuery {
  if (!validateFilters(filters)) return {}
  const min = price(filters.priceFrom)
  const max = price(filters.priceTo)
  return {
    ...(filters.categories.length ? { categories: filters.categories.join(',') } : {}),
    ...Object.fromEntries(([['suitedFor', filters.suited], ['amenities', filters.amenities], ['moods', filters.moods], ['settings', filters.settings]] as const).filter(([, keys]) => keys.length).map(([key, keys]) => [key, [...new Set(keys)].join(',')])),
    ...(filters.openNow ? { openAt: 'now' } : {}),
    ...(min !== undefined ? { priceMinPerPerson: Math.round(min * 1000) } : {}),
    ...(max !== undefined ? { priceMaxPerPerson: Math.round(max * 1000) } : {}),
  }
}
