import { useQuery } from '@tanstack/react-query'

import { pastDates, suggestedPlans } from '@/data/mockData'
import type { PastDate, SuggestedPlan } from '@/data/types'

/**
 * What is left of the mock data layer.
 *
 * The `places` vertical now runs on the real API; these two feed Home and the
 * Plans tab, which migrate in later phases (see `docs/api-migration.md`). This
 * file shrinks to nothing as those land — do not add to it.
 */
const LATENCY_MS = 350

function respond<T>(data: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), LATENCY_MS))
}

export const mockApi = {
  suggestedPlans: (): Promise<SuggestedPlan[]> => respond(suggestedPlans),
  pastDates: (): Promise<PastDate[]> => respond(pastDates),
}

export const mockQueryKeys = {
  suggestedPlans: ['mock', 'suggested-plans'] as const,
  pastDates: ['mock', 'past-dates'] as const,
}

/** Home discovery rail — replaced by `usePlaceSearch` in the plan phase. */
export function useSuggestedPlans() {
  return useQuery({ queryKey: mockQueryKeys.suggestedPlans, queryFn: mockApi.suggestedPlans })
}

/** Plans tab history — replaced by the room/plan endpoints in phase 4. */
export function usePastDates() {
  return useQuery({ queryKey: mockQueryKeys.pastDates, queryFn: mockApi.pastDates })
}
