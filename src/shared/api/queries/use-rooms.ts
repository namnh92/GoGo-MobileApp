import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as roomsApi from '../endpoints/rooms'
import { isApiError } from '../errors'
import { newIdempotencyKey } from '../idempotency'
import * as suggestionsApi from '../endpoints/suggestions'
import { queryKeys } from '../query-keys'
import type { OpBody, RoomSummary } from '../types'

/**
 * One room by id — what a screen reached from a route or a deep link needs.
 * For "the rooms I belong to", use `useMyRooms`.
 *
 * Liveness is not this hook's job: a screen that needs the room to stay fresh
 * calls `useRoomRealtime`.
 */
export function useRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.room(roomId ?? ''),
    queryFn: () => roomsApi.getRoom(roomId as string),
    enabled: Boolean(roomId),
  })
}

/** Member progress during the lobby/collecting phase. */
export function useRoomMembers(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roomMembers(roomId ?? ''),
    queryFn: () => roomsApi.listRoomMembers(roomId as string),
    enabled: Boolean(roomId),
  })
}

export function useRoomInvites(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roomInvites(roomId ?? ''),
    queryFn: () => roomsApi.listRoomInvites(roomId as string),
    enabled: Boolean(roomId),
  })
}

/** Creates the room and opens it for joining — see `createAndOpenRoom`. */
export function useCreateRoom(options?: { idempotencyKey?: () => string }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'createRoom'>) => roomsApi.createAndOpenRoom(body, options?.idempotencyKey?.()),
    onSuccess: room => {
      queryClient.setQueryData(queryKeys.room(room.id), room)
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] })
    },
  })
}

/**
 * Host action behind "start matching": moves the room into `matching` if it is
 * not there yet, then runs the suggestion pipeline.
 */
export function useStartMatching(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (options?: { allowIncompletePreferences?: boolean }) => {
      const room = await roomsApi.getRoom(roomId)
      const matching = await roomsApi.ensureRoomMatching(room, options?.allowIncompletePreferences)
      queryClient.setQueryData(queryKeys.room(roomId), matching)
      return suggestionsApi.generateSuggestions(roomId)
    },
    onSuccess: run => {
      queryClient.setQueryData(queryKeys.roomSuggestions(roomId), run)
      // The Plans tabs filter by status on the server (#213); a moved room
      // must reappear under the right tab without waiting for staleTime.
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] })
    },
  })
}

/**
 * Editing constraints bumps `constraintVersion` and marks dependent scores and
 * plans stale (RULE-CORE-006), so suggestions and the current plan are dropped
 * rather than left showing numbers computed under the old constraints.
 */
export function useUpdateRoomConstraints(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'updateRoomConstraints'>) => roomsApi.updateRoomConstraints(roomId, body),
    onSuccess: room => {
      queryClient.setQueryData(queryKeys.room(roomId), room)
      // The list carries the schedule too (GoGo-BE#574), so it is stale now.
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomSuggestions(roomId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomCurrentPlan(roomId) })
    },
    // A version conflict means the cached summary is behind: refetch it so the
    // editor can rebase onto what the room actually holds now.
    onError: error => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
      }
    },
  })
}

export function useTransitionRoom(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'transitionRoom'>) => roomsApi.transitionRoom(roomId, body),
    onSuccess: room => {
      queryClient.setQueryData(queryKeys.room(roomId), room)
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] })
    },
  })
}

export function useRemoveRoomMember(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => roomsApi.removeRoomMember(roomId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    },
  })
}

const inviteCodeKey = (roomId: string) => ['session-invite-code', roomId] as const

/** Plaintext codes stay in memory only, outside persisted room query keys. */
export function useCreateRoomInvite(roomId: string) {
  const queryClient = useQueryClient()
  const cached = useQuery({
    queryKey: inviteCodeKey(roomId),
    queryFn: async (): Promise<Awaited<ReturnType<typeof roomsApi.createRoomInvite>> | null> => null,
    enabled: false,
    gcTime: Infinity,
  })
  const mutation = useMutation({
    retry: false,
    mutationFn: async (body: OpBody<'createRoomInvite'>) => {
      const attemptKey = ['session-invite-attempt', roomId] as const
      const previous = queryClient.getQueryData<{ key: string; error?: unknown }>(attemptKey)
      if (isApiError(previous?.error) && previous.error.retryAt > Date.now()) throw previous.error
      const key = previous?.key ?? newIdempotencyKey()
      queryClient.setQueryData(attemptKey, { key })
      try {
        return await roomsApi.createRoomInvite(roomId, body, key)
      } catch (error) {
        queryClient.setQueryData(attemptKey, { key, error })
        throw error
      }
    },
    onSuccess: invite => {
      queryClient.setQueryData(inviteCodeKey(roomId), invite)
      queryClient.removeQueries({ queryKey: ['session-invite-attempt', roomId] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomInvites(roomId) })
    },
  })
  return { ...mutation, data: cached.data ?? undefined }
}

export function useRevokeRoomInvite(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => roomsApi.revokeRoomInvite(roomId, inviteId),
    onSuccess: (_result, inviteId) => {
      const cached = queryClient.getQueryData<Awaited<ReturnType<typeof roomsApi.createRoomInvite>>>(inviteCodeKey(roomId))
      if (cached?.inviteId === inviteId) queryClient.setQueryData(inviteCodeKey(roomId), null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomInvites(roomId) })
    },
  })
}

export function useJoinRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'joinRoom'>) => roomsApi.joinRoom(body),
    onSuccess: result => {
      if (result?.roomId) void queryClient.invalidateQueries({ queryKey: queryKeys.room(result.roomId) })
    },
  })
}

export function useAddRoomSeedPlaces(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: OpBody<'addRoomSeedPlaces'>) => roomsApi.addRoomSeedPlaces(roomId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    },
  })
}

export function useRemoveRoomSeedPlace(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (placeId: string) => roomsApi.removeRoomSeedPlace(roomId, placeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    },
  })
}

/** Role and capability facts derived from the room, never from local UI state. */
export function roomCapabilities(room: RoomSummary | undefined) {
  const isHost = room?.myRole === 'host'
  return {
    isHost,
    // Server enforces all of these; the UI only mirrors them (RULE-CORE-005).
    canEditConstraints: isHost,
    canRegenerate: isHost,
    canLockStops: isHost,
    canFinalize: isHost,
    canInvite: isHost,
  }
}

/**
 * The rooms the caller belongs to, newest activity first.
 *
 * This replaces reading a device-local list: a room opened on a phone used to be
 * invisible on a tablet, and clearing the app lost every room the user was still
 * a member of. Paging is keyset, so a room whose timestamp moves mid-read
 * cannot duplicate onto a later page.
 */
export function useMyRooms(options?: { status?: string; enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: queryKeys.roomList(options?.status),
    queryFn: ({ pageParam }) =>
      roomsApi.listRooms({
        ...(options?.status ? { status: options.status } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
}
