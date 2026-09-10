import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import * as meApi from '../endpoints/me'
import type { SavedTargetType } from '../endpoints/me'
import * as placesApi from '../endpoints/places'
import * as sessionsApi from '../endpoints/sessions'
import { queryKeys } from '../query-keys'
import type { OpBody, OpResponse, SavedItem } from '../types'
import { detailToPlaceCard } from '../view-models'

/** Current actor facts: `actorType` distinguishes a signed-in user from a guest. */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: sessionsApi.getMe,
    enabled: options?.enabled ?? true,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'updateProfile'>) => sessionsApi.updateProfile(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    },
  })
}

// --- saved -----------------------------------------------------------------

/** Guests get 403 USER_ONLY here — gate the call on an account session. */
export function useSaved(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.saved(),
    queryFn: meApi.listSaved,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Optimistic save/unsave — bookmarking must feel instant. Server state wins on
 * settle, so a rejected save snaps back rather than lying.
 */
export function useToggleSaved() {
  const queryClient = useQueryClient()
  const key = queryKeys.saved()

  return useMutation({
    mutationFn: ({ type, id, saved }: { type: SavedTargetType; id: string; saved: boolean }) =>
      saved ? meApi.unsaveItem(type, id) : meApi.saveItem(type, id),

    onMutate: async ({ type, id, saved }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SavedItem[]>(key)
      if (previous) {
        queryClient.setQueryData<SavedItem[]>(
          key,
          saved
            ? previous.filter(item => !(item.targetType === type && item.targetId === id))
            : [{ targetType: type, targetId: id, savedAt: new Date().toISOString() }, ...previous],
        )
      }
      return { previous }
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function isSaved(items: SavedItem[] | undefined, type: SavedTargetType, id: string): boolean {
  return Boolean(items?.some(item => item.targetType === type && item.targetId === id))
}

/**
 * `GET /me/saved` returns ids only and the contract has no batch place lookup,
 * so each saved place is fetched individually. Saved lists are small and the
 * details are cached and shared with the place-detail screen, so this stays
 * cheap — but it is the reason a large saved list would need a batch endpoint.
 */
export function useSavedPlaces(options?: { enabled?: boolean }) {
  const saved = useSaved({ enabled: options?.enabled ?? true })

  const placeIds = (saved.data ?? [])
    .filter(item => item.targetType === 'place' && item.targetId)
    .map(item => item.targetId as string)

  const details = useQueries({
    queries: placeIds.map(id => ({
      queryKey: queryKeys.place(id),
      queryFn: () => placesApi.getPlaceDetail(id),
      staleTime: 5 * 60 * 1000,
    })),
  })

  return {
    places: details.flatMap(query => (query.data ? [detailToPlaceCard(query.data)] : [])),
    savedPlanIds: (saved.data ?? [])
      .filter(item => item.targetType === 'plan' && item.targetId)
      .map(item => item.targetId as string),
    isPending: saved.isPending || details.some(query => query.isPending),
    isError: saved.isError,
    error: saved.error,
    refetch: saved.refetch,
  }
}

// --- reviews ---------------------------------------------------------------

export function useMyReviews(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.myReviews(),
    queryFn: meApi.listMyReviews,
    enabled: options?.enabled ?? true,
  })
}

/** A new review lands as `pending` moderation — never show it as published. */
export function useCreateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'createReview'>) => meApi.createReview(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myReviews() })
    },
  })
}

export function useUpdateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: OpBody<'updateReview'> & { id: string }) =>
      meApi.updateReview(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myReviews() })
    },
  })
}

// --- notifications ---------------------------------------------------------

/** Cursor-paginated inbox; the cursor is an opaque `createdAt` marker. */
export function useNotifications(options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) => meApi.listNotifications(pageParam ? { cursor: pageParam } : undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => meApi.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}

export function useNotificationPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notificationPreferences(),
    queryFn: meApi.getNotificationPreferences,
    enabled: options?.enabled ?? true,
    // Preferences change rarely and this query is persisted. Profile preloads
    // it, so the settings screen can paint from cache without waiting on GET.
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetNotificationPreference() {
  const queryClient = useQueryClient()
  const key = queryKeys.notificationPreferences()

  return useMutation({
    mutationFn: (body: OpBody<'setNotificationPreference'>) => meApi.setNotificationPreference(body),

    // Apply the tap to the cached list immediately. If the PUT fails, restore
    // the exact previous list; after it settles, reconcile with the server.
    onMutate: async body => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<OpResponse<'getNotificationPreferences'>>(key)
      const current = previous ?? []
      const found = current.some(item => item.channel === body.channel && item.kind === body.kind)

      queryClient.setQueryData<OpResponse<'getNotificationPreferences'>>(
        key,
        found
          ? current.map(item =>
              item.channel === body.channel && item.kind === body.kind
                ? { ...item, enabled: body.enabled }
                : item,
            )
          : [...current, body],
      )

      return {
        previousEntry: current.find(item => item.channel === body.channel && item.kind === body.kind),
      }
    },

    onError: (_error, body, context) => {
      queryClient.setQueryData<OpResponse<'getNotificationPreferences'>>(key, current => {
        const withoutFailed = (current ?? []).filter(
          item => !(item.channel === body.channel && item.kind === body.kind),
        )
        return context?.previousEntry ? [...withoutFailed, context.previousEntry] : withoutFailed
      })
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
