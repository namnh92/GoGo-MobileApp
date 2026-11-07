import { fireEvent, render, screen } from '@testing-library/react-native'
import '@/shared/i18n'
import type { RoomListItem } from '@/shared/api'
import { nearestUpcomingRoom } from '@/features/tabs/profile-upcoming'
import { ProfileUpcoming } from '@/features/tabs/profile-upcoming.view'

const mockFetch = jest.fn()
const mockRefetch = jest.fn()
const mockPush = jest.fn()
const mockQuery = { data: { pages: [] as { items: RoomListItem[] }[] }, hasNextPage: false, isFetching: false, isPending: false, isError: false, isFetchNextPageError: false, fetchNextPage: mockFetch, refetch: mockRefetch }
jest.mock('@/shared/api', () => ({ useMyRooms: () => mockQuery }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
function room(id: string, date?: string, overrides: Partial<RoomListItem> = {}): RoomListItem {
  return { id, type: 'group', status: 'ready', decisionMode: 'vote', participantCount: 4, updatedAt: '2026-11-08T00:00:00Z', myRole: 'member', myMemberId: 'm', title: id, startAt: date, ...overrides }
}
beforeEach(() => {
  Object.assign(mockQuery, { data: { pages: [] }, hasNextPage: false, isFetching: false, isPending: false, isError: false, isFetchNextPageError: false })
  mockFetch.mockReset(); mockRefetch.mockReset(); mockPush.mockReset()
})
it('selects by schedule rather than updated order and ignores unscheduled, past and terminal rooms', () => {
  const now = Date.parse('2026-11-08T00:00:00Z')
  const rooms = [room('later', '2026-11-10T00:00:00Z'), room('past', '2026-11-07T00:00:00Z'), room('unscheduled'), room('cancelled', '2026-11-08T01:00:00Z', { status: 'cancelled' }), room('next', undefined, { scheduledDate: '2026-11-09T00:00:00Z' })]
  expect(nearestUpcomingRoom(rooms, now)?.id).toBe('next')
  expect(nearestUpcomingRoom([room('invalid', 'bad-date')], now)).toBeUndefined()
})
it('waits for all pages before advertising the nearest room and opens the ready plan', async () => {
  mockQuery.data.pages = [{ items: [room('later', '2099-12-31T00:00:00Z')] }]
  mockQuery.hasNextPage = true
  const view = await render(<ProfileUpcoming enabled />)
  expect(mockFetch).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('profile-upcoming')).toBeNull()
  mockQuery.data.pages.push({ items: [room('nearest', '2099-01-01T00:00:00Z', { planId: 'p' })] })
  mockQuery.hasNextPage = false
  await view.rerender(<ProfileUpcoming enabled />)
  expect(screen.getByText('nearest')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('profile-upcoming'))
  expect(mockPush).toHaveBeenCalledWith('/plans/p')
})
it('an undecided room opens its lobby even when an older plan exists', async () => {
  mockQuery.data.pages = [{ items: [room('deciding', '2099-01-01T00:00:00Z', { status: 'collecting', planId: 'old' })] }]
  await render(<ProfileUpcoming enabled />)
  await fireEvent.press(screen.getByTestId('profile-upcoming'))
  expect(mockPush).toHaveBeenCalledWith('/room/deciding')
})
it('does not expose cached account rooms after switching to guest', async () => {
  mockQuery.data.pages = [{ items: [room('private', '2099-01-01T00:00:00Z')] }]
  await render(<ProfileUpcoming enabled={false} />)
  expect(screen.queryByTestId('profile-upcoming')).toBeNull()
  expect(mockFetch).not.toHaveBeenCalled()
})
it('retries the failed next page without showing a misleading partial banner', async () => {
  Object.assign(mockQuery, { hasNextPage: true, isError: true, isFetchNextPageError: true })
  mockQuery.data.pages = [{ items: [room('partial', '2099-01-01T00:00:00Z')] }]
  await render(<ProfileUpcoming enabled />)
  expect(mockFetch).not.toHaveBeenCalled()
  expect(screen.queryByTestId('profile-upcoming')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(mockFetch).toHaveBeenCalledTimes(1)
})
