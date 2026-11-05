import { render, screen } from '@testing-library/react-native'

import '@/shared/i18n'

/**
 * #475 — the Kèo card counts the "Sắp tới" rooms, read through the hook behind
 * the Kế hoạch tab badge, worded by the same `badgeLabel`. A signed-out
 * person has no count (a dash, never a false zero); a guest is unchanged.
 */

const mockUpcoming = { count: 0, more: false, live: false }
const mockSession: { status: 'user' | 'guest' | 'anonymous' } = { status: 'user' }
const mockRecent: { rooms: unknown[] } = { rooms: [] }

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({
    session: mockSession.status === 'anonymous' ? null : { kind: mockSession.status, userId: 'u' },
    status: mockSession.status,
    signOut: jest.fn(),
  }),
}))
// jest.setup.js mocks this with a fixed zero; this file needs real values.
jest.mock('@/features/tabs/upcoming-rooms', () => ({
  ...jest.requireActual('@/features/tabs/upcoming-rooms'),
  useUpcomingRooms: () => mockUpcoming,
}))
jest.mock('@/shared/store/recentRoomsStore', () => ({
  useRecentRoomsStore: (select: (s: { rooms: unknown[] }) => unknown) => select(mockRecent),
}))
jest.mock('@/shared/api', () => {
  const idle = { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() }
  return { useMe: () => idle, useSaved: () => idle, useMyReviews: () => idle, useNotificationSettings: () => idle }
})

import ProfileScreen from '@/features/tabs/profile.view'

beforeEach(() => {
  Object.assign(mockUpcoming, { count: 0, more: false, live: false })
  mockSession.status = 'user'
  mockRecent.rooms = []
})

it('shows the Sắp tới count, on the card and in its label', async () => {
  Object.assign(mockUpcoming, { count: 3 })
  mockRecent.rooms = [{}, {}, {}, {}, {}] // the device list no longer decides it
  await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 3' })).toBeTruthy()
  expect(screen.getAllByText('3').length).toBeGreaterThan(0)
})

it('reads a real zero as 0', async () => {
  await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 0' })).toBeTruthy()
})

it('says "+" when a further page exists, and caps at 9+', async () => {
  Object.assign(mockUpcoming, { count: 4, more: true })
  const view = await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 4+' })).toBeTruthy()
  expect(screen.getByText('4+')).toBeTruthy()
  Object.assign(mockUpcoming, { count: 12, more: true })
  await view.rerender(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 9+' })).toBeTruthy()
})

it('signed out: a dash and a bare label, not a zero', async () => {
  mockSession.status = 'anonymous'
  mockRecent.rooms = [{}, {}]
  await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo' })).toBeTruthy()
  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /^Kèo: / })).toBeNull()
})

it('guest: unchanged, the rooms this device has seen', async () => {
  mockSession.status = 'guest'
  Object.assign(mockUpcoming, { count: 7 })
  mockRecent.rooms = [{}, {}]
  await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 2' })).toBeTruthy()
})
