import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  forgetInviteCode,
  inviteCodeGeneration,
  loadInviteCode,
  purgeInviteCodes,
  saveInviteCode,
  type StoredInvite,
} from '@/shared/storage/invite-codes'

const ROOM = '311f5bd8-f853-4ced-af68-e04398d1451a'
const OTHER = '9b0f6c2e-1d7a-4c55-9a51-3f0b5e2d8c11'
const USER = 'user-1'
const FUTURE = '2099-01-01T00:00:00.000Z'
const INDEX = 'gogo.invite-code.v1.index'
const entryKey = (roomId: string) => `gogo.invite-code.v1.${roomId}`

function invite(roomId = ROOM, overrides: Partial<StoredInvite> = {}): StoredInvite {
  return {
    roomId,
    inviteId: `invite-${roomId.slice(0, 4)}`,
    code: `code-${roomId.slice(0, 4)}`,
    expiresAt: FUTURE,
    userId: USER,
    savedAt: 1,
    ...overrides,
  }
}

afterEach(async () => {
  await purgeInviteCodes()
  vi.restoreAllMocks()
})

describe('invite code store (#199)', () => {
  it('keeps one code per room in secure storage and never in AsyncStorage', async () => {
    const asyncWrite = vi.spyOn(AsyncStorage, 'setItem')
    await saveInviteCode(invite())
    await saveInviteCode(invite(OTHER))
    expect(await loadInviteCode(ROOM, USER)).toEqual(invite())
    expect(await loadInviteCode(OTHER, USER)).toEqual(invite(OTHER))
    expect(await SecureStore.getItemAsync(entryKey(ROOM))).toContain('code-311f')
    expect(asyncWrite).not.toHaveBeenCalled()
  })

  it('purges every stored room', async () => {
    await saveInviteCode(invite())
    await saveInviteCode(invite(OTHER))
    await purgeInviteCodes()
    expect(await loadInviteCode(ROOM, USER)).toBeNull()
    expect(await loadInviteCode(OTHER, USER)).toBeNull()
    expect(await SecureStore.getItemAsync(INDEX)).toBeNull()
  })

  it("never returns another account's code, and drops it", async () => {
    await saveInviteCode(invite(ROOM, { userId: 'someone-else' }))
    expect(await loadInviteCode(ROOM, USER)).toBeNull()
    expect(await SecureStore.getItemAsync(entryKey(ROOM))).toBeNull()
  })

  it('forgets a code only when it belongs to the named invite', async () => {
    await saveInviteCode(invite())
    await forgetInviteCode(ROOM, 'some-other-invite')
    expect(await loadInviteCode(ROOM, USER)).not.toBeNull()
    await forgetInviteCode(ROOM, invite().inviteId)
    expect(await loadInviteCode(ROOM, USER)).toBeNull()
  })

  it('drops a save that began before a purge', async () => {
    const startedAt = inviteCodeGeneration()
    await purgeInviteCodes()
    await saveInviteCode(invite(), startedAt)
    expect(await loadInviteCode(ROOM, USER)).toBeNull()
  })

  it('never trusts an unreadable or misfiled entry', async () => {
    await SecureStore.setItemAsync(entryKey(ROOM), '{not json')
    expect(await loadInviteCode(ROOM, USER)).toBeNull()
    await SecureStore.setItemAsync(entryKey(ROOM), JSON.stringify(invite(OTHER)))
    expect(await loadInviteCode(ROOM, USER)).toBeNull()
    expect(await SecureStore.getItemAsync(entryKey(ROOM))).toBeNull()
  })

  it('prunes other rooms whose code has expired when saving', async () => {
    await saveInviteCode(invite(OTHER, { expiresAt: '2000-01-01T00:00:00.000Z' }))
    await saveInviteCode(invite())
    expect(await SecureStore.getItemAsync(entryKey(OTHER))).toBeNull()
    expect(JSON.parse((await SecureStore.getItemAsync(INDEX)) ?? '[]')).toEqual([ROOM])
  })

  it('keeps the index to the newest 20 rooms and deletes the older codes', async () => {
    const rooms = Array.from({ length: 22 }, (_, index) => `room-${index}`)
    for (const [index, roomId] of rooms.entries()) await saveInviteCode(invite(roomId, { savedAt: index + 1 }))
    const stored: string[] = JSON.parse((await SecureStore.getItemAsync(INDEX)) ?? '[]')
    expect(stored).toHaveLength(20)
    expect(stored).not.toContain('room-0')
    expect(stored).not.toContain('room-1')
    expect(await SecureStore.getItemAsync(entryKey('room-0'))).toBeNull()
    expect(await SecureStore.getItemAsync(entryKey('room-1'))).toBeNull()
    expect(await loadInviteCode('room-2', USER)).not.toBeNull()
    expect(await loadInviteCode('room-21', USER)).not.toBeNull()
    // Twenty room ids stay far below the ~2048-byte SecureStore value limit.
    expect(((await SecureStore.getItemAsync(INDEX)) ?? '').length).toBeLessThan(2048)
  })

  it('refuses a room id that cannot be a storage key, or a missing account', async () => {
    expect(await loadInviteCode('../etc', USER)).toBeNull()
    await saveInviteCode(invite())
    expect(await loadInviteCode(ROOM, '')).toBeNull()
    await expect(forgetInviteCode('a b')).resolves.toBeUndefined()
  })
})
