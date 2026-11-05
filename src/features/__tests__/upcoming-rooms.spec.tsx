import { renderHook } from '@testing-library/react-native'

import { useUpcomingRooms } from '@/features/tabs/upcoming-rooms'

jest.unmock('@/features/tabs/upcoming-rooms')

const mockSession = { status: 'user' }
const mockPage = {
  items: [{ status: 'collecting' }, { status: 'ready' }] as { status: string }[],
  nextCursor: null as string | null,
}
let mockAsked: string | undefined
jest.mock('@/shared/api', () => ({
  useMyRooms: (options: { status: string }) => {
    mockAsked = options.status
    return { data: { pages: [mockPage] } }
  },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))

beforeEach(() => {
  mockSession.status = 'user'
  mockPage.items = [{ status: 'collecting' }, { status: 'ready' }]
  mockPage.nextCursor = null
})

it('counts every room the "Sắp tới" tab lists, not only live ones', async () => {
  const { result } = await renderHook(() => useUpcomingRooms())
  expect(mockAsked).toBe('draft,collecting,matching,ready,active')
  expect(result.current).toEqual({ count: 2, more: false, live: false })
})

it('marks live when a date is happening, and more when a page follows', async () => {
  mockPage.items = [{ status: 'active' }]
  mockPage.nextCursor = 'next'
  const { result } = await renderHook(() => useUpcomingRooms())
  expect(result.current).toEqual({ count: 1, more: true, live: true })
})

it('ignores what the cache kept after sign-out', async () => {
  mockSession.status = 'anonymous'
  const { result } = await renderHook(() => useUpcomingRooms())
  expect(result.current).toEqual({ count: 0, more: false, live: false })
})
