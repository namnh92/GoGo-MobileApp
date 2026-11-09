import { type QueryClient, type UseMutationResult, useInfiniteQuery, useIsMutating, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import * as meApi from '../endpoints/me'
import type { SavedTargetType } from '../endpoints/me'
import * as placesApi from '../endpoints/places'
import * as profileApi from '../endpoints/profile'
import * as sessionsApi from '../endpoints/sessions'
import { queryKeys } from '../query-keys'
import { helpfulDelta, withHelpfulDelta, withMyMark, withServerState, type ReviewCache } from '../review-reactions'
import { assertSessionGeneration, captureSessionScope, getSessionGeneration } from '../session'
import type { MyReviewReactions, OpBody, OpResponse, SavedItem } from '../types'
import { detailToPlaceCard, type PlaceCard } from '../view-models'
import { isApiError } from '../errors'
import { inboxKinds, type InboxCategory } from './use-notification-filter'
import { useIntentKey } from './use-intent-key'
import { newIdempotencyKey } from '../idempotency'

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
      const scope = captureSessionScope()
      await queryClient.cancelQueries({ queryKey: key })
      scope.assert()
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
 * Separate hook instances share a queue for each target. Keep the optimistic
 * update and rollback inside it too, so a queued PUT sees the settled removal.
 */
const savedMutations = new WeakMap<QueryClient, Map<string, Promise<void>>>()
function reserveSavedMutation(client: QueryClient, target: string) {
  let pending = savedMutations.get(client)
  if (!pending) {
    pending = new Map()
    savedMutations.set(client, pending)
  }
  const queue = pending
  const ready = queue.get(target) ?? Promise.resolve()
  let unlock: () => void = () => {}
  const done = new Promise<void>(resolve => { unlock = resolve })
  queue.set(target, done)
  return {
    ready,
    release: () => {
      if (queue.get(target) === done) queue.delete(target)
      unlock()
    },
  }
}

type SavedMutation = { type: SavedTargetType; id: string; saved: boolean }
type SavedMutationContext = { previous: SavedItem | undefined; release: () => void }

/**
 * Optimistic save/unsave — bookmarking must feel instant. Server state wins on
 * settle, so a rejected save snaps back rather than lying.
 */
export function useToggleSaved(): UseMutationResult<void, Error, SavedMutation, SavedMutationContext> {
  const queryClient = useQueryClient()
  const key = queryKeys.saved()

  const mutation = useMutation({
    mutationFn: async ({ type, id, saved, generation }: SavedMutation & { generation: number }) => {
      // TanStack re-enters here for every retry, even after its cache was cleared.
      const scope = captureSessionScope(generation)
      await (saved ? meApi.unsaveItem(type, id, generation) : meApi.saveItem(type, id, generation))
      scope.assert()
    },

    onMutate: async ({ type, id, saved, generation }) => {
      const scope = captureSessionScope(generation)
      // Hold the turn through TanStack's automatic retries and final rollback.
      const turn = reserveSavedMutation(queryClient, `${generation}:${type}:${id}`)
      const release = () => {
        scope.signal.removeEventListener('abort', release)
        turn.release()
      }
      // Session cancellation skips onSettled, so it must also unlock the queue.
      scope.signal.addEventListener('abort', release, { once: true })
      try {
        await scope.wait(turn.ready)
        await queryClient.cancelQueries({ queryKey: key })
        scope.assert()
        const matches = (item: SavedItem) => item.targetType === type && item.targetId === id
        const previous = queryClient.getQueryData<SavedItem[]>(key)?.find(matches)
        queryClient.setQueryData<SavedItem[]>(key, current => {
          if (!current) return current
          if (saved) return current.filter(item => !matches(item))
          return current.some(matches) ? current
            : [{ targetType: type, targetId: id, savedAt: new Date().toISOString(), area: PENDING_AREA }, ...current]
        })
        return { previous, release }
      } catch (error) {
        release()
        throw error
      }
    },

    onError: (_error, { type, id, generation }, context) => {
      if (!context || generation !== getSessionGeneration()) return
      // Other places can mutate concurrently; roll back only this target.
      queryClient.setQueryData<SavedItem[]>(key, current => {
        if (!current) return current
        const others = current.filter(item => !(item.targetType === type && item.targetId === id))
        return context.previous ? [context.previous, ...others] : others
      })
    },

    onSettled: (_data, _error, { generation }, context) => {
      try {
        if (generation === getSessionGeneration()) void queryClient.invalidateQueries({ queryKey: key })
      }
      finally { context?.release() }
    },
  })

  // Capture on invocation, before any async lifecycle callback or queue wait.
  return {
    ...mutation,
    mutate: (variables, options) => mutation.mutate({ ...variables, generation: getSessionGeneration() }, options),
    mutateAsync: (variables, options) => mutation.mutateAsync({ ...variables, generation: getSessionGeneration() }, options),
  }
}

export function isSaved(items: SavedItem[] | undefined, type: SavedTargetType, id: string): boolean {
  return Boolean(items?.some(item => item.targetType === type && item.targetId === id))
}

/** A saved item with its area facts and, once loaded, what it points at. */
export type SavedEntry = {
  key: string
  type: 'place'
  id: string
  area: SavedItem['area']
  detailError?: unknown
  place?: PlaceCard
}

/** Hydrate saved places only; legacy saved plans remain untouched on the server. */
export function useSavedEntries(options?: { enabled?: boolean }) {
  const saved = useSaved({ enabled: options?.enabled ?? true })
  const items = (options?.enabled ?? true) ? (saved.data ?? []).filter(item => item.targetType === 'place') : []
  const placeIds = items.map(item => item.targetId)
  const places = useQueries({
    queries: placeIds.map(id => ({
      queryKey: queryKeys.place(id),
      queryFn: () => placesApi.getPlaceDetail(id),
      staleTime: 5 * 60 * 1000,
    })),
  })
  const placeById = new Map<string, PlaceCard>()
  places.forEach((query, index) => {
    if (query.data) placeById.set(placeIds[index]!, detailToPlaceCard(query.data))
  })
  const entries: SavedEntry[] = items.map(item => ({
    key: `${item.targetType}:${item.targetId}`,
    type: 'place',
    id: item.targetId,
    area: item.area,
    detailError: places[placeIds.indexOf(item.targetId)]?.error,
    place: placeById.get(item.targetId),
  }))

  return {
    entries,
    isPending: saved.isPending || places.some(query => query.isPending),
    isPaused: saved.isPaused || places.some(query => query.isPaused),
    isError: saved.isError,
    error: saved.error,
    refetch: () => Promise.all([saved.refetch(), ...places.map(query => query.refetch())]),
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
  // One key per tap, replayed by automatic retries (#315 F-01).
  const intent = useIntentKey()
  return useMutation({
    mutationFn: (body: OpBody<'createReview'>) => meApi.createReview(body, intent.keyFor(body)),
    onSettled: (_data, _error, body) => intent.release(body),
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

/** APP-060 (#219) — the caller's own helpful marks on one place. Accounts only. */
export function useMyReviewReactions(placeId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.myReviewReactions(placeId),
    queryFn: () => meApi.listMyReviewReactions(placeId),
    enabled: (options?.enabled ?? true) && Boolean(placeId),
    staleTime: 30 * 1000,
  })
}

/**
 * APP-060 (#219) — mark or unmark a review helpful, optimistically. The count
 * and the toggle move on tap; a failure puts back exactly what was there; a
 * success writes the server's count; either way both reads refetch, because a
 * mark can change the helpful order. A tap that asks for the state the review
 * is already in changes nothing, and the server would not count it either.
 */
export function useToggleReviewHelpful(placeId: string) {
  const queryClient = useQueryClient()
  const previewsKey = queryKeys.placeReviewsAll(placeId)
  const mineKey = queryKeys.myReviewReactions(placeId)

  return useMutation({
    mutationFn: ({ reviewId, helpful }: { reviewId: string; helpful: boolean }) =>
      helpful ? meApi.markReviewHelpful(reviewId) : meApi.unmarkReviewHelpful(reviewId),

    onMutate: async ({ reviewId, helpful }) => {
      const scope = captureSessionScope()
      await Promise.all([
        queryClient.cancelQueries({ queryKey: previewsKey }),
        queryClient.cancelQueries({ queryKey: mineKey }),
      ])
      scope.assert()
      const previews = queryClient.getQueriesData<ReviewCache>({ queryKey: previewsKey })
      const mine = queryClient.getQueryData<MyReviewReactions>(mineKey)
      const delta = helpfulDelta(mine, reviewId, helpful)
      if (delta !== 0) {
        for (const [key, data] of previews) queryClient.setQueryData(key, withHelpfulDelta(data, reviewId, delta))
        queryClient.setQueryData(mineKey, withMyMark(mine, placeId, reviewId, helpful))
      }
      return { previews, mine }
    },

    onError: (_error, _variables, context) => {
      if (!context) return
      for (const [key, data] of context.previews) queryClient.setQueryData(key, data)
      queryClient.setQueryData(mineKey, context.mine)
    },

    onSuccess: state => {
      for (const [key, data] of queryClient.getQueriesData<ReviewCache>({ queryKey: previewsKey })) {
        queryClient.setQueryData(key, withServerState(data, state))
      }
      queryClient.setQueryData(
        mineKey,
        withMyMark(queryClient.getQueryData<MyReviewReactions>(mineKey), placeId, state.reviewId, state.reactedByMe),
      )
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: previewsKey })
      void queryClient.invalidateQueries({ queryKey: mineKey })
    },
  })
}

// --- notifications ---------------------------------------------------------

/** Cursor-paginated inbox; pass opaque (createdAt,id) cursors back unchanged. */
export function useNotifications(options?: { enabled?: boolean; category?: InboxCategory }) {
  const category = options?.category ?? 'all'
  const kinds = inboxKinds[category]
  return useInfiniteQuery({
    queryKey: queryKeys.notifications(category),
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam?.cursor
      const clientFilter = pageParam?.clientFilter ?? false
      const query = { ...(cursor ? { cursor } : {}), ...(!clientFilter && kinds ? { kinds } : {}) }
      try {
        const page = await meApi.listNotifications(Object.keys(query).length ? query : undefined)
        return { ...page, clientFilter }
      } catch (error) {
        // Only the first request can negotiate an old BE. Never replay a
        // filter-bound cursor against an unfiltered feed.
        if (!cursor && kinds && !clientFilter && isApiError(error) && error.status === 400) {
          return { ...await meApi.listNotifications(), clientFilter: true }
        }
        throw error
      }
    },
    initialPageParam: undefined as { cursor: string; clientFilter: boolean } | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, clientFilter: lastPage.clientFilter } : undefined,
    enabled: options?.enabled ?? true,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const scope = captureSessionScope()
      await scope.wait(meApi.markNotificationRead(id, scope.generation))
      await scope.wait(refetchNotificationInbox(queryClient))
    },
  })
}

/** One account cache shared by bell, profile and inbox; never persisted to disk. */
export function useNotificationSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notificationSummary(),
    queryFn: ({ signal }) => meApi.getNotificationSummary(signal),
    enabled: options?.enabled ?? true,
  })
}

function refetchNotificationInbox(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notificationSummary(), exact: true }),
  ])
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient()
  const intent = useIntentKey()
  return useMutation({
    mutationFn: async (through: string) => {
      const scope = captureSessionScope()
      let operation = await scope.wait(meApi.readAllNotifications({ through }, intent.keyFor(through), scope.generation))
      // Both 200 and 202 carry status. A replay may still describe a running
      // operation; only the authenticated status read establishes completion.
      while (operation.status === 'running') {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await scope.wait(new Promise<void>(resolve => { timer = setTimeout(resolve, 1000) }))
        } finally {
          clearTimeout(timer)
        }
        operation = await scope.wait(meApi.getNotificationReadOperation(operation.operationId, scope.generation))
      }
      scope.assert()
      await scope.wait(refetchNotificationInbox(queryClient))
      return operation
    },
    onSettled: (_data, _error, through) => intent.release(through),
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
 * Optimistic: the switch moves on tap and moves back if the write fails, then the
 * server's answer wins. It writes the preference and nothing else — no push
 * subscription, no inbox — so a toggle cannot duplicate a device registration
 * or empty the inbox.
 */
export function useSetNotificationSettings() {
  const queryClient = useQueryClient()
  const key = queryKeys.notificationSettings()
  type Body = OpBody<'patchNotificationSettings'>
  type Resource = meApi.NotificationSettingsResource
  // Keep the original validator/key on ambiguous failures, including a manual
  // retry. A 412 is definitive: refetch before making a new conditional intent.
  const intents = useRef(new WeakMap<Body, { etag: string; key: string; generation: number }>())
  const pending = useIsMutating({ mutationKey: key })

  const mutation = useMutation({
    mutationKey: key,
    mutationFn: (body: Body) => {
      const current = queryClient.getQueryData<Resource>(key)
      const intent = intents.current.get(body)!
      assertSessionGeneration(intent.generation)
      if (current?.categories || body.categories) {
        if (!/^"[^"\r\n]+"$/.test(intent.etag)) throw new Error('Notification settings need a fresh validator')
        return meApi.patchNotificationSettings(body, intent.etag, intent.key, intent.generation)
      }
      // Compatibility for a deployment still serving the pre-category resource.
      if (typeof body.pushEnabled !== 'boolean') throw new Error('Notification settings unavailable')
      return meApi.setNotificationSettings({ pushEnabled: body.pushEnabled })
    },

    onMutate: async body => {
      const scope = captureSessionScope()
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      scope.assert()
      const previous = queryClient.getQueryData<Resource>(key)
      const intent = intents.current.get(body)
      if (intent) assertSessionGeneration(intent.generation)
      else intents.current.set(body, { etag: previous?.etag ?? '', key: newIdempotencyKey(), generation: scope.generation })
      if (previous) {
        queryClient.setQueryData<Resource>(key, {
          ...previous,
          ...(typeof body.pushEnabled === 'boolean' ? { pushEnabled: body.pushEnabled } : {}),
          ...(body.categories && previous.categories ? { categories: { ...previous.categories, ...body.categories } } : {}),
        })
      }
      return { previous, generation: scope.generation }
    },

    onError: (error, body, context) => {
      if (isApiError(error) && error.status === 412) intents.current.delete(body)
      if (context?.previous && context.generation === getSessionGeneration()) queryClient.setQueryData(key, context.previous)
    },

    onSuccess: (settings, body, context) => {
      intents.current.delete(body)
      if (context?.generation === getSessionGeneration()) queryClient.setQueryData(key, settings)
    },

    onSettled: (_data, _error, _body, context) => {
      if (context?.generation === getSessionGeneration()) return queryClient.invalidateQueries({ queryKey: key, exact: true })
    },
  })
  return { ...mutation, isPending: mutation.isPending || pending > 0 }
}
