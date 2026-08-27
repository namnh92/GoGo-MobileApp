import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as meApi from '../endpoints/me'
import type { SavedTargetType } from '../endpoints/me'
import * as sessionsApi from '../endpoints/sessions'
import { queryKeys } from '../query-keys'
import type { OpBody, SavedItem } from '../types'

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

export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => meApi.listNotifications(),
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
  })
}

export function useSetNotificationPreference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'setNotificationPreference'>) => meApi.setNotificationPreference(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
    },
  })
}

export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: (body: OpBody<'registerDeviceToken'>) => meApi.registerDeviceToken(body),
  })
}
