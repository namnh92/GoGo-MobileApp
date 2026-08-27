import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import * as placesApi from '../endpoints/places'
import * as plansApi from '../endpoints/plans'
import { queryKeys } from '../query-keys'
import type { OpBody, Plan } from '../types'
import { detailToPlaceCard, type PlaceCard } from '../view-models'

/** Liveness comes from `useRoomRealtime`, never from a per-screen interval. */
export function useCurrentPlan(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roomCurrentPlan(roomId ?? ''),
    queryFn: () => plansApi.getCurrentPlan(roomId as string),
    enabled: Boolean(roomId),
  })
}

export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.plan(planId ?? ''),
    queryFn: () => plansApi.getPlan(planId as string),
    enabled: Boolean(planId),
  })
}

/**
 * A `PlanStop` carries a `placeId` and nothing else about the place, and the
 * contract has no batch place lookup, so each stop's details are fetched
 * individually. A plan has at most eight stops and the details are cached and
 * shared with the place-detail screen, so this stays cheap.
 */
export function usePlanStopPlaces(stops: readonly { placeId: string }[]) {
  const placeIds = [...new Set(stops.map(stop => stop.placeId).filter(Boolean))]

  const details = useQueries({
    queries: placeIds.map(id => ({
      queryKey: queryKeys.place(id),
      queryFn: () => placesApi.getPlaceDetail(id),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const byPlaceId = new Map<string, PlaceCard>()
  for (const query of details) {
    if (query.data?.id) byPlaceId.set(query.data.id, detailToPlaceCard(query.data))
  }

  return { byPlaceId, isPending: details.some(query => query.isPending) }
}

/** Every plan mutation returns the new version — write it to both cache keys. */
function useWritePlan() {
  const queryClient = useQueryClient()
  return (plan: Plan) => {
    if (plan.id) queryClient.setQueryData(queryKeys.plan(plan.id), plan)
    if (plan.roomId) queryClient.setQueryData(queryKeys.roomCurrentPlan(plan.roomId), plan)
  }
}

export function useEditPlanStops(planId: string) {
  const writePlan = useWritePlan()
  return useMutation({
    mutationFn: (body: OpBody<'editPlanStops'>) => plansApi.editPlanStops(planId, body),
    onSuccess: writePlan,
  })
}

/**
 * Host-only regenerate. Locked stops come back verbatim (RULE-CORE-007) — the
 * server guarantees it, and the returned plan is the only source of truth for
 * what survived.
 */
export function useRegeneratePlan(planId: string) {
  const writePlan = useWritePlan()
  return useMutation({
    mutationFn: (body: OpBody<'regeneratePlan'> = {}) => plansApi.regeneratePlan(planId, body),
    onSuccess: writePlan,
  })
}

/**
 * Optimistic lock toggle: the padlock must respond instantly, but the returned
 * plan replaces the guess because locking can shift times and totals.
 */
export function useLockPlanStop(planId: string) {
  const queryClient = useQueryClient()
  const writePlan = useWritePlan()
  const key = queryKeys.plan(planId)

  return useMutation({
    mutationFn: ({ stopId, locked }: { stopId: string; locked: boolean }) =>
      plansApi.lockPlanStop(planId, stopId, locked),

    onMutate: async ({ stopId, locked }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Plan>(key)
      if (previous) {
        queryClient.setQueryData<Plan>(key, {
          ...previous,
          stops: previous.stops?.map(stop =>
            stop.id === stopId ? { ...stop, isLocked: locked } : stop,
          ),
        })
      }
      return { previous }
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSuccess: writePlan,
  })
}

export function useCompletePlanStop(planId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stopId: string) => plansApi.completePlanStop(planId, stopId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) })
    },
  })
}

/**
 * Stop check-in. `photoKeys` are uploaded-object keys, not local URIs — upload
 * first, then send the keys. `billTotal` requires `billPhotoKey`.
 */
export function useCheckinPlanStop(planId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stopId, ...body }: OpBody<'checkinPlanStop'> & { stopId: string }) =>
      plansApi.checkinPlanStop(planId, stopId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) })
    },
  })
}
