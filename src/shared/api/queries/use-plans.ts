import { queryOptions, useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import * as placesApi from '../endpoints/places'
import * as plansApi from '../endpoints/plans'
import { isRoomNotActive } from '../errors'
import { queryKeys } from '../query-keys'
import type { OpBody, PlaceDetail, Plan } from '../types'
import { detailToPlaceCard, type PlaceCard } from '../view-models'
import { useIntentKey } from './use-intent-key'

type PlanPlaceSummary = Pick<PlaceDetail, 'id' | 'name' | 'addressText' | 'lat' | 'lng' | 'freshnessCheckedAt'>

/** Explicit allowlist: no provider imagery, ratings or moderated aggregates. */
function planPlaceSummary(detail: PlaceDetail): PlanPlaceSummary {
  const { id, name, addressText, lat, lng, freshnessCheckedAt } = detail
  return { id, name, addressText, lat, lng, freshnessCheckedAt }
}

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
 * shared with the place-detail screen, so this stays cheap. Only a minimal
 * summary survives disk persistence for the active date's offline fallback.
 */
export function usePlanStopPlaces(stops: readonly { placeId: string }[]) {
  const queryClient = useQueryClient()
  const placeIds = [...new Set(stops.map(stop => stop.placeId).filter(Boolean))]

  const details = useQueries({
    queries: placeIds.map(id => ({
      queryKey: queryKeys.place(id),
      queryFn: () => placesApi.getPlaceDetail(id),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const summaries = useQueries({
    queries: placeIds.map(id => queryOptions<PlanPlaceSummary>({
      queryKey: queryKeys.planPlaceSummary(id),
      // Updated from the full-detail observer below, never fetched separately.
      enabled: false,
      initialData: () => queryClient.getQueryData<PlanPlaceSummary>(queryKeys.planPlaceSummary(id)),
    })),
  })

  useEffect(() => {
    for (const query of details) {
      if (!query.data?.id) continue
      const key = queryKeys.planPlaceSummary(query.data.id)
      // useQueries returns a new array each render. The source timestamp makes
      // this idempotent and also captures details already cached before mount.
      if (queryClient.getQueryState(key)?.dataUpdatedAt === query.dataUpdatedAt) continue
      queryClient.setQueryData(key, planPlaceSummary(query.data), { updatedAt: query.dataUpdatedAt })
    }
  }, [details, queryClient])

  const byPlaceId = new Map<string, PlaceCard>()
  for (const [index, query] of details.entries()) {
    const place = query.data ?? summaries[index]?.data
    if (place?.id) byPlaceId.set(place.id, detailToPlaceCard(place))
  }

  return { byPlaceId, isPending: details.some((query, index) => query.isPending && !summaries[index]?.data) }
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
  // One key per tap, replayed by automatic retries (#315 F-01).
  const intent = useIntentKey()
  return useMutation({
    mutationFn: (body?: OpBody<'regeneratePlan'>) => plansApi.regeneratePlan(planId, body ?? {}, intent.keyFor(body)),
    onSuccess: writePlan,
    onSettled: (_data, _error, body) => intent.release(body),
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

/**
 * #251 — `409 ROOM_NOT_ACTIVE` means the cached room status is what was wrong.
 * Refetch the room so the plan screen the user goes back to shows where it
 * really is.
 */
function refreshRoomIfNotActive(queryClient: QueryClient, planId: string, error: unknown) {
  if (!isRoomNotActive(error)) return
  const roomId = queryClient.getQueryData<Plan>(queryKeys.plan(planId))?.roomId
  if (roomId) void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId), exact: true })
}

export function useCompletePlanStop(planId: string) {
  const queryClient = useQueryClient()
  const intent = useIntentKey()
  return useMutation({
    mutationFn: (stopId: string) => plansApi.completePlanStop(planId, stopId, intent.keyFor(stopId)),
    onSettled: (_data, _error, stopId) => intent.release(stopId),
    // #278 — the answer carries no plan, and the refetch lands after the caller
    // has moved on. Until then the cached plan still shows this stop in
    // progress, and another tap would complete it a second time.
    onSuccess: (_answer, stopId) => {
      queryClient.setQueryData<Plan>(queryKeys.plan(planId), plan =>
        plan
          ? {
              ...plan,
              stops: plan.stops?.map(stop => (stop.id === stopId ? { ...stop, status: 'completed' as const } : stop)),
            }
          : plan,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) })
    },
    onError: error => refreshRoomIfNotActive(queryClient, planId, error),
  })
}

/**
 * Stop check-in. `photoKeys` are uploaded-object keys, not local URIs — upload
 * first, then send the keys. `billTotal` requires `billPhotoKey`.
 */
export function useCheckinPlanStop(planId: string) {
  const queryClient = useQueryClient()
  const intent = useIntentKey()
  return useMutation({
    mutationFn: (variables: OpBody<'checkinPlanStop'> & { stopId: string }) => {
      const { stopId, ...body } = variables
      return plansApi.checkinPlanStop(planId, stopId, body, intent.keyFor(variables))
    },
    onSettled: (_data, _error, variables) => intent.release(variables),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) })
    },
    onError: error => refreshRoomIfNotActive(queryClient, planId, error),
  })
}
