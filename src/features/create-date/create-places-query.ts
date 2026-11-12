import type { PlaceSearchQuery } from '@/shared/api'
import type { PickerScope } from '@/shared/location/picker-scope'
import { scopeSearchParams } from '@/shared/location/discovery-scope'
import { budgetModeFor, type BudgetMode, type DemoAudience } from '@/shared/store/roomStore'

/** Same canonical area/GPS scope as the seed picker; prices are per person. */
export function createPlacesQuery(scope: PickerScope | null, draft: {
  audience: DemoAudience; budgetMode: BudgetMode; budgetAmount: number | null; participantCount: number
}, locale: string): PlaceSearchQuery {
  const count = draft.audience === 'couple' ? 2 : draft.participantCount
  const amount = draft.budgetAmount
  const price = amount != null && Number.isFinite(amount) && amount > 0
    ? budgetModeFor(draft.audience, draft.budgetMode) === 'total' ? Math.floor(amount / count) : amount
    : undefined
  return {
    ...(scope ? scopeSearchParams(scope) : {}),
    ...(scope?.source === 'gps' ? { radiusM: scope.radiusM } : {}),
    ...(price !== undefined ? { priceMaxPerPerson: price } : {}),
    suitedFor: draft.audience === 'couple' ? 'couple' : 'group',
    locale: locale.startsWith('en') ? 'en' : 'vi', limit: 10,
  }
}
