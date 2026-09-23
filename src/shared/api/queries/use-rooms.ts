import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

import {
  forgetInviteCode,
  inviteCodeGeneration,
  loadInviteCode,
  saveInviteCode,
  type StoredInvite,
} from '@/shared/storage/invite-codes'

import * as roomsApi from '../endpoints/rooms'
import { isApiError, isForbidden } from '../errors'
import { newIdempotencyKey } from '../idempotency'
import * as suggestionsApi from '../endpoints/suggestions'
import { queryKeys } from '../query-keys'
import { getSession } from '../session'
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

/**
 * #251 — the host's "Bắt đầu đi": `ready → active` through `startRoomDate`.
 *
 * `start()` is single-flight. A second tap while the first request is out
 * resolves `null` and sends nothing, so one press is one transition and one
 * `date_reminder` push to the members. `onSend` runs only for the call that
 * actually sends, so a joined tap is not a second analytics event either. It
 * resolves the room as the server holds it after the attempt — `active`, or
 * whatever a race left it in — and the caller acts on that status. It rejects
 * with the API error when there is no room to report.
 *
 * Any answer refreshes the room, its plan and the Plans tabs, which filter by
 * room status (#213). A 403 means the cached role is behind, so the room is
 * refetched and the screen re-renders from what the server holds.
 */
export function useStartDate(roomId: string | undefined, planId?: string) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    // The button is the retry. The default automatic retry kept it hidden behind
    // a spinner (about 3 s offline, far longer on a timeout), and paused while
    // offline it would spin forever. An explicit tap must end in an answer.
    retry: false,
    networkMode: 'always',
    mutationFn: () => roomsApi.startRoomDate(roomId as string),
    onSuccess: room => {
      queryClient.setQueryData(queryKeys.room(room.id), room)
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(room.id), exact: true })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomCurrentPlan(room.id) })
      if (planId) void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) })
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] })
    },
    onError: error => {
      if (roomId && isForbidden(error)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId), exact: true })
      }
    },
  })

  const { mutateAsync } = mutation
  const start = useCallback(async (options?: { onSend?: () => void }): Promise<RoomSummary | null> => {
    if (!roomId || inFlight.current) return null
    inFlight.current = true
    try {
      options?.onSend?.()
      return await mutateAsync()
    } finally {
      inFlight.current = false
    }
  }, [roomId, mutateAsync])

  return { ...mutation, start }
}

/**
 * #269 — the host's "Kết thúc date": `active → completed`.
 *
 * Single-flight like starting the date, for the same reason: the last stop's
 * sheet can close twice in quick succession and one ending is one transition.
 * Only the host may send it, so the caller checks the role first — a member
 * closing the same sheet ends their own screen and nothing else.
 *
 * Every answer refreshes the room, its plan and the Plans tabs, which filter by
 * room status (#213): a finished date has to leave the active tab and appear in
 * history.
 */
export function useFinishDate(roomId: string | undefined, planId?: string) {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const mutation = useMutation({
    /**
     * Bounded automatic retry, unlike every other button in the app.
     *
     * The person can leave the summary — hardware back, a swipe — and take the
     * retry control with them while the room is still `active`. A transient
     * failure must not depend on them being there to press anything, so the
     * mutation keeps trying on its own for a short while; the visible retry is
     * for when that runs out.
     */
    retry: 2,
    retryDelay: attempt => Math.min(2_000 * 2 ** attempt, 15_000),
    networkMode: 'always',
    mutationFn: () => roomsApi.finishRoomDate(roomId as string),
    onSuccess: room => {
      queryClient.setQueryData(queryKeys.room(room.id), room)
      void queryClient.invalidateQueries({ queryKey: queryKeys.room(room.id), exact: true })
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomCurrentPlan(room.id) })
      if (planId) void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) })
      void queryClient.invalidateQueries({ queryKey: ['rooms', 'list'] })
    },
    onError: error => {
      // A refusal means the cached role is behind what the server believes.
      if (roomId && isForbidden(error)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId), exact: true })
      }
    },
  })

  const { mutateAsync } = mutation
  const finish = useCallback(async (): Promise<RoomSummary | null> => {
    if (!roomId || inFlight.current) return null
    inFlight.current = true
    try {
      return await mutateAsync()
    } finally {
      inFlight.current = false
    }
  }, [roomId, mutateAsync])

  return { ...mutation, finish }
}

/** APP-049 (#202): the list shows the name too, so it refetches; nothing goes stale. */
export function useRenameRoom(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title: string | null) => roomsApi.renameRoom(roomId, { title }),
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

const inviteCodeKey = (roomId: string, userId: string) => ['session-invite-code', roomId, userId] as const
const inviteAttemptKey = (roomId: string) => ['session-invite-attempt', roomId] as const

/**
 * The API returns a plaintext code exactly once and keeps only its hash
 * (GoGo-BE ADR-0018). The code is kept in Keychain/Keystore so the host still
 * has it after a reopen or a cold start (#199), and in memory under a key the
 * query persister never writes — never in AsyncStorage, a log or analytics.
 * Each entry names the account that created it and is read back only for it.
 *
 * `stored` is `undefined` until the device store has been read, then the
 * stored invite or `null`.
 */
export function useCreateRoomInvite(roomId: string | undefined) {
  const queryClient = useQueryClient()
  const userId = getSession()?.userId ?? ''
  const stored = useQuery({
    queryKey: inviteCodeKey(roomId ?? '', userId),
    queryFn: () => (userId ? loadInviteCode(roomId as string, userId) : Promise.resolve(null)),
    enabled: Boolean(roomId),
    // A keychain read needs no network; offline it must not pause and leave
    // the card checking forever.
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  const mutation = useMutation({
    retry: false,
    // Captured before the request: a logout while it is in flight must not
    // leave the code it returns behind on the device.
    onMutate: () => ({ generation: inviteCodeGeneration() }),
    mutationFn: async (body: OpBody<'createRoomInvite'>) => {
      const id = roomId as string
      const previous = queryClient.getQueryData<{ key: string; error?: unknown }>(inviteAttemptKey(id))
      if (isApiError(previous?.error) && previous.error.retryAt > Date.now()) throw previous.error
      const key = previous?.key ?? newIdempotencyKey()
      queryClient.setQueryData(inviteAttemptKey(id), { key })
      try {
        return await roomsApi.createRoomInvite(id, body, key)
      } catch (error) {
        queryClient.setQueryData(inviteAttemptKey(id), { key, error })
        throw error
      }
    },
    onSuccess: async (invite, _body, context) => {
      const id = roomId as string
      queryClient.removeQueries({ queryKey: inviteAttemptKey(id) })
      if (context && context.generation !== inviteCodeGeneration()) return
      const record: StoredInvite = {
        roomId: id,
        inviteId: invite.inviteId,
        code: invite.code,
        expiresAt: invite.expiresAt,
        userId,
        savedAt: Date.now(),
      }
      // A refused keychain write still shows the code for this session; after a
      // reopen the room reports the invite as active and offers a new one.
      if (userId) await saveInviteCode(record, context?.generation).catch(() => undefined)
      await queryClient.cancelQueries({ queryKey: inviteCodeKey(id, userId) })
      queryClient.setQueryData(inviteCodeKey(id, userId), record)
      // A list refetch already in flight would land without this invite and make
      // the screen forget the code it just showed. The list is refetched by the
      // lobby poll (it invalidates the whole `['rooms', id]` prefix), on focus,
      // and before the code is copied or shared.
      await queryClient.cancelQueries({ queryKey: queryKeys.roomInvites(id) })
      queryClient.setQueryData<unknown>(queryKeys.roomInvites(id), (list: unknown) =>
        Array.isArray(list)
          ? [
              ...list.filter(row => (row as { inviteId?: string } | null)?.inviteId !== invite.inviteId),
              { inviteId: invite.inviteId, expiresAt: invite.expiresAt, revoked: false, useCount: 0, maxUses: invite.maxUses },
            ]
          : list,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.roomInvites(id) })
    },
  })
  const forget = useCallback(
    async (inviteId: string) => {
      if (!roomId) return
      await forgetInviteCode(roomId, inviteId)
      const cached = queryClient.getQueryData<StoredInvite | null>(inviteCodeKey(roomId, userId))
      if (cached?.inviteId === inviteId) queryClient.setQueryData(inviteCodeKey(roomId, userId), null)
    },
    [queryClient, roomId, userId],
  )
  return { ...mutation, data: stored.data ?? undefined, stored: stored.data, forget }
}

export function useRevokeRoomInvite(roomId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => roomsApi.revokeRoomInvite(roomId, inviteId),
    onSuccess: async (_result, inviteId) => {
      const codeKey = inviteCodeKey(roomId, getSession()?.userId ?? '')
      const cached = queryClient.getQueryData<StoredInvite | null>(codeKey)
      if (cached?.inviteId === inviteId) queryClient.setQueryData(codeKey, null)
      // An earlier create's idempotency key could replay the invite just revoked.
      queryClient.removeQueries({ queryKey: inviteAttemptKey(roomId) })
      // A revoked code can never let anyone in; it must not come back on reopen.
      await forgetInviteCode(roomId, inviteId)
      // Marked here, not only on refetch: if the create that follows a re-issue
      // fails, the card must fall back to "create", not keep a dead invite.
      await queryClient.cancelQueries({ queryKey: queryKeys.roomInvites(roomId) })
      queryClient.setQueryData<unknown>(queryKeys.roomInvites(roomId), (list: unknown) =>
        Array.isArray(list)
          ? list.map(row =>
              (row as { inviteId?: string } | null)?.inviteId === inviteId ? { ...(row as object), revoked: true } : row,
            )
          : list,
      )
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
