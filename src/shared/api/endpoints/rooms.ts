import { api } from '../client'
import { isConflict } from '../errors'
import { newIdempotencyKey } from '../idempotency'
import { persistSession, sessionFromGuestGrant, type Session } from '../session'
import type { OpBody, OpQuery, OpResponse } from '../types'

/**
 * The rooms the caller belongs to, most recently active first.
 *
 * Keyset paging on `(updatedAt, id)` rather than an offset, because a room's
 * timestamp moves while the list is being read — one vote is enough to shift a
 * row onto a page the reader already passed.
 */
export function listRooms(query: OpQuery<'listRooms'> = {}): Promise<OpResponse<'listRooms'>> {
  return api.get<OpResponse<'listRooms'>>('/rooms', { query })
}

export function createRoom(
  body: OpBody<'createRoom'>,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'createRoom'>> {
  return api.post<OpResponse<'createRoom'>>('/rooms', body, { idempotencyKey })
}

/**
 * Rooms are created in `draft`, and only a `collecting` room auto-flips to
 * `matching` when the last member finishes their preferences. A room left in
 * `draft` silently dead-ends: preferences save fine and the server even answers
 * `roomReadyForMatching: true`, but suggestions then fail with
 * `ROOM_NOT_MATCHING`. Creating a room in this app always means opening it for
 * people to join, so the two steps travel together.
 */
export async function createAndOpenRoom(
  body: OpBody<'createRoom'>,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'createRoom'>> {
  const room = await createRoom(body, idempotencyKey)
  if (room.status !== 'draft') return room
  return transitionRoom(room.id, { status: 'collecting' })
}

/**
 * Walks the room to `matching` along legal transitions
 * (`draft → collecting → matching`). Needed when members completed their
 * preferences while the room was still `draft`, because the auto-flip only
 * runs inside a completion and will not re-run afterwards. `matching` has no
 * self-loop, so an already-matching room is returned untouched.
 */
export async function ensureRoomMatching(room: OpResponse<'getRoom'>, allowIncompletePreferences = false): Promise<OpResponse<'getRoom'>> {
  let current = room
  if (current.status === 'draft') {
    current = await transitionRoom(current.id, { status: 'collecting' })
  }
  if (current.status === 'collecting') {
    current = await transitionRoom(current.id, { status: 'matching', allowIncompletePreferences })
  }
  return current
}

export function getRoom(roomId: string): Promise<OpResponse<'getRoom'>> {
  return api.get<OpResponse<'getRoom'>>('/rooms/{id}', { pathParams: { id: roomId } })
}

/**
 * Constraint edits carry `expectedConstraintVersion`; a 409 means someone else
 * edited first — refetch the room and re-apply (RULE-CORE-006: a constraint
 * change marks dependent scores and plans stale).
 */
export function updateRoomConstraints(
  roomId: string,
  body: OpBody<'updateRoomConstraints'>,
): Promise<OpResponse<'updateRoomConstraints'>> {
  return api.patch<OpResponse<'updateRoomConstraints'>>('/rooms/{id}/constraints', body, {
    pathParams: { id: roomId },
  })
}

export function transitionRoom(
  roomId: string,
  body: OpBody<'transitionRoom'>,
): Promise<OpResponse<'transitionRoom'>> {
  return api.patch<OpResponse<'transitionRoom'>>('/rooms/{id}/status', body, {
    pathParams: { id: roomId },
  })
}

/**
 * #251 — "Bắt đầu đi": the host moves the room `ready → active` (SRS §7.2
 * "start date"). Stop completion and check-in answer `409 ROOM_NOT_ACTIVE`
 * until this has happened, so opening the active-date screen is not enough.
 *
 * Resolves the room as the server holds it after the attempt, and the caller
 * acts on its `status` — never on "the request succeeded". Today a second send
 * (another device, or a retry whose first attempt landed) answers
 * `409 INVALID_ROOM_TRANSITION`, so the room is re-read. Once starting is
 * idempotent (GoGo-BE #601), a repeated start that races the end of the date
 * answers `200` with a `completed` or `cancelled` room instead. Both paths hand
 * back the same thing: whatever the room is now.
 */
export async function startRoomDate(roomId: string): Promise<OpResponse<'transitionRoom'>> {
  try {
    return await transitionRoom(roomId, { status: 'active' })
  } catch (error) {
    if (!isConflict(error)) throw error
    return getRoom(roomId)
  }
}

/**
 * BE-BFF-022 — host-only while the room is being planned. `null` (or an empty
 * string) clears the name. A name is not a constraint, so there is no version
 * to send and nothing goes stale.
 */
export function renameRoom(roomId: string, body: OpBody<'renameRoom'>): Promise<OpResponse<'renameRoom'>> {
  return api.patch<OpResponse<'renameRoom'>>('/rooms/{id}/title', body, { pathParams: { id: roomId } })
}

export function listRoomMembers(roomId: string): Promise<OpResponse<'listRoomMembers'>> {
  return api.get<OpResponse<'listRoomMembers'>>('/rooms/{id}/members', { pathParams: { id: roomId } })
}

export function removeRoomMember(roomId: string, memberId: string): Promise<void> {
  return api.delete<void>('/rooms/{id}/members/{memberId}', undefined, {
    pathParams: { id: roomId, memberId },
  })
}

export function createRoomInvite(
  roomId: string,
  body: OpBody<'createRoomInvite'>,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'createRoomInvite'>> {
  return api.post<OpResponse<'createRoomInvite'>>('/rooms/{id}/invites', body, {
    idempotencyKey,
    pathParams: { id: roomId },
  })
}

export function listRoomInvites(roomId: string): Promise<OpResponse<'listRoomInvites'>> {
  return api.get<OpResponse<'listRoomInvites'>>('/rooms/{id}/invites', { pathParams: { id: roomId } })
}

export function revokeRoomInvite(roomId: string, inviteId: string): Promise<void> {
  return api.delete<void>('/rooms/{id}/invites/{inviteId}', undefined, {
    pathParams: { id: roomId, inviteId },
  })
}

/** Authenticated join. Idempotent server-side: re-joining returns the membership. */
export function joinRoom(body: OpBody<'joinRoom'>): Promise<OpResponse<'joinRoom'>> {
  return api.post<OpResponse<'joinRoom'>>('/rooms/join', body)
}

/** Guest join by invite code — persists the room-scoped guest session. */
export async function joinRoomAsGuest(body: OpBody<'joinRoomAsGuest'>): Promise<Session> {
  const grant = await api.post<OpResponse<'joinRoomAsGuest'>>('/rooms/join/guest', body, {
    anonymous: true,
  })
  return persistSession(sessionFromGuestGrant(grant))
}

export function addRoomSeedPlaces(
  roomId: string,
  body: OpBody<'addRoomSeedPlaces'>,
): Promise<OpResponse<'addRoomSeedPlaces'>> {
  return api.post<OpResponse<'addRoomSeedPlaces'>>('/rooms/{id}/seed-places', body, {
    pathParams: { id: roomId },
  })
}

export function removeRoomSeedPlace(roomId: string, placeId: string): Promise<void> {
  return api.delete<void>('/rooms/{id}/seed-places/{placeId}', undefined, {
    pathParams: { id: roomId, placeId },
  })
}
