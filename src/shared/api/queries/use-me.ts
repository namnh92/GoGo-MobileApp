import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import * as meApi from '../endpoints/me'
import type { SavedTargetType } from '../endpoints/me'
import * as placesApi from '../endpoints/places'
import * as plansApi from '../endpoints/plans'
import * as profileApi from '../endpoints/profile'
import * as sessionsApi from '../endpoints/sessions'
import { queryKeys } from '../query-keys'
import type { OpBody, OpResponse, SavedItem, Plan } from '../types'
import { detailToPlaceCard, type PlaceCard } from '../view-models'

/** Current actor facts: `actorType` distinguishes a signed-in user from a guest. */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: sessionsApi.getMe,
    enabled: options?.enabled ?? true,
  })
}

/**
 * PROF-APP-006 (#217) — set or clear the date of birth. The `me` cache shows
 * the new value at once; a refused save puts the previous profile back, and
 * the server's answer wins once it lands. Every write checks the cached
 * profile is still the same account, so a save that settles after a sign-out
 * and a sign-in never paints one person's date onto another's profile.
 */
export function useUpdateDateOfBirth() {
  const queryClient = useQueryClient()
  const key = queryKeys.me()
  type Profile = OpResponse<'getMe'>
  const sameAccount = (id: string | undefined) => queryClient.getQueryData<Profile>(key)?.id === id

  return useMutation({
    mutationFn: (dateOfBirth: string | null) => sessionsApi.updateProfile({ dateOfBirth }),

    onMutate: async dateOfBirth => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Profile>(key)
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, dateOfBirth })
      return { previous }
    },

    onError: (_error, _dateOfBirth, context) => {
      if (context?.previous && sameAccount(context.previous.id)) {
        queryClient.setQueryData(key, context.previous)
      }
    },

    onSuccess: profile => {
      if (sameAccount(profile.id)) queryClient.setQueryData(key, profile)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
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

/**
 * ADR-0022 — attach the uploaded original and publish the avatar. The server
 * answers the whole profile, so it becomes the `me` cache directly; member
 * lists show the same picture, so every room is refetched on next read.
 */
export function useSetAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (uploadKey: string) => profileApi.setAvatar({ uploadKey }),
    onSuccess: profile => {
      queryClient.setQueryData(queryKeys.me(), profile)
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms() })
    },
  })
}

/**
 * Reference data like taxonomies: stable keys, changes when an editor changes
 * it. Cached long; the edge caches it an hour too.
 */
export function useServiceAreas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.serviceAreas(),
    queryFn: () => profileApi.listServiceAreas(),
    staleTime: 60 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => profileApi.removeAvatar(),
    onSuccess: profile => {
      queryClient.setQueryData(queryKeys.me(), profile)
      void queryClient.invalidateQueries({ queryKey: queryKeys.rooms() })
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

/** A just-saved item's area is unknown until the server answers — never guessed. */
const PENDING_AREA: SavedItem['area'] = {
  scope: 'unknown',
  datasetVersion: null,
  provinceCode: null,
  provinceName: null,
  communeCode: null,
  communeName: null,
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
            : [{ targetType: type, targetId: id, savedAt: new Date().toISOString(), area: PENDING_AREA }, ...previous],
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

/** A saved item with its area facts and, once loaded, what it points at. */
export type SavedEntry = {
  key: string
  type: 'place' | 'plan'
  id: string
  area: SavedItem['area']
  place?: PlaceCard
  plan?: Plan
}

/**
 * ADM-205 (#214) — every saved place and plan with its area facts. The list is
 * one response, so grouping sees all of it; details load per item and are
 * shared with the place and plan screens' caches.
 */
export function useSavedEntries(options?: { enabled?: boolean }) {
  const saved = useSaved({ enabled: options?.enabled ?? true })
  const items = saved.data ?? []
  const placeIds = items.filter(item => item.targetType === 'place').map(item => item.targetId)
  const planIds = items.filter(item => item.targetType === 'plan').map(item => item.targetId)

  const places = useQueries({
    queries: placeIds.map(id => ({
      queryKey: queryKeys.place(id),
      queryFn: () => placesApi.getPlaceDetail(id),
      staleTime: 5 * 60 * 1000,
    })),
  })
  const plans = useQueries({
    queries: planIds.map(id => ({
      queryKey: queryKeys.plan(id),
      queryFn: () => plansApi.getPlan(id),
      staleTime: 60 * 1000,
    })),
  })

  const placeById = new Map<string, PlaceCard>()
  places.forEach((query, index) => {
    if (query.data) placeById.set(placeIds[index]!, detailToPlaceCard(query.data))
  })
  const planById = new Map<string, Plan>()
  plans.forEach((query, index) => {
    if (query.data) planById.set(planIds[index]!, query.data)
  })

  const entries: SavedEntry[] = items.map(item => ({
    key: `${item.targetType}:${item.targetId}`,
    type: item.targetType,
    id: item.targetId,
    area: item.area,
    ...(item.targetType === 'place' && placeById.has(item.targetId) ? { place: placeById.get(item.targetId) } : {}),
    ...(item.targetType === 'plan' && planById.has(item.targetId) ? { plan: planById.get(item.targetId) } : {}),
  }))

  return {
    entries,
    isPending: saved.isPending || places.some(query => query.isPending) || plans.some(query => query.isPending),
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

/**
 * NTF-APP-010 (#215) — the account's one push switch. Persisted under `me`, so
 * Profile warms it and the screen paints from cache; signing in or out purges
 * `me` before another account can read it.
 */
export function useNotificationSettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notificationSettings(),
    queryFn: meApi.getNotificationSettings,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Optimistic: the switch moves on tap and moves back if the PUT fails, then the
 * server's answer wins. It writes the preference and nothing else — no push
 * subscription, no inbox — so a toggle cannot duplicate a device registration
 * or empty the inbox.
 */
export function useSetNotificationSettings() {
  const queryClient = useQueryClient()
  const key = queryKeys.notificationSettings()

  return useMutation({
    mutationFn: (body: OpBody<'setNotificationSettings'>) => meApi.setNotificationSettings(body),

    onMutate: async body => {
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<OpResponse<'getNotificationSettings'>>(key)
      if (previous) {
        queryClient.setQueryData<OpResponse<'getNotificationSettings'>>(key, {
          ...previous,
          pushEnabled: body.pushEnabled,
        })
      }
      return { previous }
    },

    onError: (_error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },

    onSuccess: settings => {
      queryClient.setQueryData(key, settings)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key, exact: true })
    },
  })
}
