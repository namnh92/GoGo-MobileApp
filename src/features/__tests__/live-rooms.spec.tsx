import { renderHook } from '@testing-library/react-native'

import { useLiveRoomCount } from '@/features/tabs/live-rooms'

jest.unmock('@/features/tabs/live-rooms')

const mockSession = { status: 'user' }
jest.mock('@/shared/api', () => ({
  useMyRooms: () => ({ data: { pages: [{ items: [{ id: 'r1' }, { id: 'r2' }] }] } }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))

it('counts live rooms for an account', async () => {
  mockSession.status = 'user'
  const { result } = await renderHook(() => useLiveRoomCount())
  expect(result.current).toBe(2)
})

it('ignores what the cache kept after sign-out (#463)', async () => {
  mockSession.status = 'anonymous'
  const { result } = await renderHook(() => useLiveRoomCount())
  expect(result.current).toBe(0)
})
