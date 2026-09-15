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
const FUTURE = '2099-01-01T00:00:00.000Z'

function invite(roomId = ROOM, overrides: Partial<StoredInvite> = {}): StoredInvite {
  return { roomId, inviteId: `invite-${roomId.slice(0, 4)}`, code: `code-${roomId.slice(0, 4)}`, expiresAt: FUTURE, savedAt: 1, ...overrides }
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
    expect(await loadInviteCode(ROOM)).toEqual(invite())
    expect(await loadInviteCode(OTHER)).toEqual(invite(OTHER))
    expect(await SecureStore.getItemAsync(`gogo.invite-code.v1.${ROOM}`)).toContain('code-311f')
    expect(asyncWrite).not.toHaveBeenCalled()
  })

  it('purges every stored room', async () => {
    await saveInviteCode(invite())
    await saveInviteCode(invite(OTHER))
    await purgeInviteCodes()
    expect(await loadInviteCode(ROOM)).toBeNull()
    expect(await loadInviteCode(OTHER)).toBeNull()
    expect(await SecureStore.getItemAsync('gogo.invite-code.v1.index')).toBeNull()
  })

  it('forgets a code only when it belongs to the named invite', async () => {
    await saveInviteCode(invite())
    await forgetInviteCode(ROOM, 'some-other-invite')
    expect(await loadInviteCode(ROOM)).not.toBeNull()
    await forgetInviteCode(ROOM, invite().inviteId)
    expect(await loadInviteCode(ROOM)).toBeNull()
  })

  it('drops a save that began before a purge', async () => {
    const startedAt = inviteCodeGeneration()
    await purgeInviteCodes()
    await saveInviteCode(invite(), startedAt)
    expect(await loadInviteCode(ROOM)).toBeNull()
  })

  it('never trusts an unreadable or misfiled entry', async () => {
    await SecureStore.setItemAsync(`gogo.invite-code.v1.${ROOM}`, '{not json')
    expect(await loadInviteCode(ROOM)).toBeNull()
    await SecureStore.setItemAsync(`gogo.invite-code.v1.${ROOM}`, JSON.stringify(invite(OTHER)))
    expect(await loadInviteCode(ROOM)).toBeNull()
    expect(await SecureStore.getItemAsync(`gogo.invite-code.v1.${ROOM}`)).toBeNull()
  })

  it('prunes other rooms whose code has expired when saving', async () => {
    await saveInviteCode(invite(OTHER, { expiresAt: '2000-01-01T00:00:00.000Z' }))
    await saveInviteCode(invite())
    expect(await SecureStore.getItemAsync(`gogo.invite-code.v1.${OTHER}`)).toBeNull()
    expect(JSON.parse((await SecureStore.getItemAsync('gogo.invite-code.v1.index')) ?? '[]')).toEqual([ROOM])
  })

  it('refuses a room id that cannot be a storage key', async () => {
    expect(await loadInviteCode('../etc')).toBeNull()
    await expect(forgetInviteCode('a b')).resolves.toBeUndefined()
  })
})
