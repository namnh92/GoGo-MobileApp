import { z } from 'zod'

import { deleteSecureItem, getSecureItem, setSecureItem } from './secure-store'

/**
 * GoGo-MobileApp#199 (owner decision 2026-09-15). The API keeps an invite as a
 * hash and returns its code exactly once (GoGo-BE ADR-0018), so the device
 * that created a code is the only place it can come back from after a reopen
 * or a cold start. It is kept in Keychain/Keystore, one entry per room, and
 * nowhere else: never AsyncStorage, the persisted query cache, a log,
 * analytics or a URL (RULE-SEC-002).
 *
 * SecureStore cannot list its keys, so an index of room ids is what lets
 * logout and account deletion find every entry.
 */
const ENTRY_PREFIX = 'gogo.invite-code.v1.'
const INDEX_KEY = 'gogo.invite-code.v1.index'
// SecureStore keys accept only alphanumerics, '.', '-' and '_'.
const SAFE_ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/

export const storedInviteSchema = z.object({
  roomId: z.string().regex(SAFE_ROOM_ID),
  inviteId: z.string().min(1),
  code: z.string().min(1),
  expiresAt: z.string().refine(value => Number.isFinite(Date.parse(value))),
  /** When this device stored it: an invite list fetched earlier cannot disprove it. */
  savedAt: z.number().int().nonnegative(),
})
export type StoredInvite = z.infer<typeof storedInviteSchema>

const indexSchema = z.array(z.string().regex(SAFE_ROOM_ID))

// Index updates are read-modify-write; one queue keeps a save and a purge from
// interleaving.
let generation = 0
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(action)
  queue = next
  return next
}

const entryKey = (roomId: string) => `${ENTRY_PREFIX}${roomId}`

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function readIndex(): Promise<string[]> {
  const parsed = indexSchema.safeParse(parseJson(await getSecureItem(INDEX_KEY)))
  return parsed.success ? parsed.data : []
}

async function writeIndex(roomIds: string[]): Promise<void> {
  if (roomIds.length === 0) await deleteSecureItem(INDEX_KEY)
  else await setSecureItem(INDEX_KEY, JSON.stringify(roomIds))
}

async function readEntry(roomId: string): Promise<StoredInvite | null> {
  const raw = await getSecureItem(entryKey(roomId))
  if (!raw) return null
  const parsed = storedInviteSchema.safeParse(parseJson(raw))
  if (parsed.success && parsed.data.roomId === roomId) return parsed.data
  // An unreadable or misfiled entry is never trusted, and not left behind.
  await deleteSecureItem(entryKey(roomId))
  return null
}

/** Bumped by every purge. A save that began before one must not land after it. */
export function inviteCodeGeneration(): number {
  return generation
}

export function saveInviteCode(invite: StoredInvite, startedAt = generation): Promise<void> {
  return serial(async () => {
    if (startedAt !== generation) return
    const record = storedInviteSchema.parse(invite)
    const now = Date.now()
    const kept: string[] = []
    const dropped: string[] = []
    for (const roomId of await readIndex()) {
      if (roomId === record.roomId) continue
      const entry = await readEntry(roomId)
      // Rooms that are never reopened must not pile up expired codes.
      if (entry && Date.parse(entry.expiresAt) > now) kept.push(roomId)
      else dropped.push(roomId)
    }
    // Index first: an entry the index does not name could never be purged.
    await writeIndex([...kept, record.roomId])
    await setSecureItem(entryKey(record.roomId), JSON.stringify(record))
    for (const roomId of dropped) await deleteSecureItem(entryKey(roomId))
  })
}

export function loadInviteCode(roomId: string): Promise<StoredInvite | null> {
  if (!SAFE_ROOM_ID.test(roomId)) return Promise.resolve(null)
  return serial(() => readEntry(roomId))
}

/** Forgets a room's code; when an invite is named, only if the code is that invite's. */
export function forgetInviteCode(roomId: string, inviteId?: string): Promise<void> {
  if (!SAFE_ROOM_ID.test(roomId)) return Promise.resolve()
  return serial(async () => {
    if (inviteId !== undefined) {
      const entry = await readEntry(roomId)
      if (entry && entry.inviteId !== inviteId) return
    }
    await deleteSecureItem(entryKey(roomId))
    const index = await readIndex()
    if (index.includes(roomId)) await writeIndex(index.filter(id => id !== roomId))
  })
}

/** Logout, session expiry, a different sign-in and account deletion. */
export function purgeInviteCodes(): Promise<void> {
  generation += 1
  return serial(async () => {
    for (const roomId of await readIndex()) await deleteSecureItem(entryKey(roomId))
    await deleteSecureItem(INDEX_KEY)
  })
}
