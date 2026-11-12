import type { QueryClient } from '@tanstack/react-query'
import { listRoomInvites } from '@/shared/api/endpoints/rooms'
import { queryKeys } from '@/shared/api/query-keys'
import { createRoomInviteInSession } from '@/shared/api/queries/use-rooms'
import { captureSessionScope, getSession } from '@/shared/api/session'
import { inviteCodeGeneration } from '@/shared/storage/invite-codes'
import { activeRoomInvites } from './invite-state'

// Share a pending preparation with create retries and a quick header tap.
const pending = new WeakMap<QueryClient, Map<string, Promise<void>>>()
function key(roomId: string) { return `${getSession()?.userId ?? ''}:${inviteCodeGeneration()}:${roomId}` }
export function pendingRoomInvite(client: QueryClient, roomId: string) { return pending.get(client)?.get(key(roomId)) }

export function prepareRoomInvite(client: QueryClient, roomId: string): Promise<void> {
  let tasks = pending.get(client)
  if (!tasks) { tasks = new Map(); pending.set(client, tasks) }
  const identity = key(roomId)
  const existing = tasks.get(identity)
  if (existing) return existing
  const scope = captureSessionScope()
  const task = (async () => {
    const list = await listRoomInvites(roomId)
    scope.assert()
    const active = activeRoomInvites(list, Date.now())
    if (!active) return // An unreadable list cannot prove absence.
    client.setQueryData(queryKeys.roomInvites(roomId), list)
    if (active.length) return
    await createRoomInviteInSession(client, roomId, { maxUses: 20 })
  })().finally(() => { tasks.delete(identity) })
  tasks.set(identity, task)
  return task
}
