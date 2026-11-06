import type { PlaceSearchQuery } from '@/shared/api/endpoints/places'

/** Only filters supported by the deployed contract are exposed. #774 adds groups here. */
export interface DiscoveryFilters {
  categories: string[]
  priceFrom: string
  priceTo: string
  suited: 'couple' | 'group' | null
  openNow: boolean
}
export const emptyFilters = (): DiscoveryFilters => ({ categories: [], priceFrom: '', priceTo: '', suited: null, openNow: false })
function price(value: string): number | undefined {
  if (!value.trim()) return undefined
  return Number(value.replace(',', '.'))
}
export function validateFilters(filters: DiscoveryFilters): boolean {
  const min = price(filters.priceFrom)
  const max = price(filters.priceTo)
  return [min, max].every(value => value === undefined || (Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 1000)))) && (min === undefined || max === undefined || min <= max)
}
export function filterParams(filters: DiscoveryFilters): PlaceSearchQuery {
  if (!validateFilters(filters)) return {}
  const min = price(filters.priceFrom)
  const max = price(filters.priceTo)
  return {
    ...(filters.categories.length ? { categories: filters.categories.join(',') } : {}),
    ...(filters.suited ? { suitedFor: filters.suited } : {}),
    ...(filters.openNow ? { openAt: 'now' } : {}),
    ...(min !== undefined ? { priceMinPerPerson: Math.round(min * 1000) } : {}),
    ...(max !== undefined ? { priceMaxPerPerson: Math.round(max * 1000) } : {}),
  }
}
