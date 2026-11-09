import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '../client'
import { previewRoomInvite } from '../invite-preview'
import { ApiError } from '../errors'
import { shouldPersistQuery } from '../persist-policy'
vi.mock('../client', () => ({ api: { post: vi.fn() } }))
const facts = { inviter: { displayName: 'Mai', avatarUrl: null, emailVerified: true }, roomType: 'group', participantCount: 7 }
beforeEach(() => vi.clearAllMocks())
it('reads 200 through the existing client with a body credential, and never joins', async () => {
  vi.mocked(api.post).mockResolvedValue(facts)
  const abort = new AbortController()
  expect(await previewRoomInvite({ inviteCode: 'secret' }, abort.signal)).toEqual(facts)
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/rooms/invites/preview', { inviteCode: 'secret' }, { anonymous: true, signal: abort.signal })
  expect(shouldPersistQuery(['invite-preview', 1])).toBe(false)
})
it.each([[404, 'INVITE_NOT_FOUND'], [410, 'INVITE_NOT_USABLE'], [410, 'ROOM_NOT_JOINABLE'], [410, 'ROOM_EXPIRED'], [429, 'RATE_LIMITED']])('preserves %s %s for guest-join error handling', async (status, code) => {
  const error = new ApiError(status as number, { code: code as string, message: 'generic' })
  vi.mocked(api.post).mockRejectedValue(error)
  await expect(previewRoomInvite({ inviteCode: 'secret' })).rejects.toBe(error)
  expect(api.post).toHaveBeenCalledTimes(1)
})
it.each([{ ...facts, participantCount: -1 }, { ...facts, budget: { mode: 'per_person', amount: 0.5, currency: 'VND' } }, { inviter: { displayName: 'secret' } }])('rejects malformed facts without exposing payloads', async value => {
  vi.mocked(api.post).mockResolvedValue(value)
  await expect(previewRoomInvite({ inviteCode: 'secret' })).rejects.toThrow('INVALID_INVITE_PREVIEW')
})
