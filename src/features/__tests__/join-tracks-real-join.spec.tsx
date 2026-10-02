import { fireEvent, waitFor } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * GoGo-BE#607 (Mobile half) — `POST /rooms/join` answers 201 with the same body
 * for a first join and for a member (or the host) reopening the invite, so the
 * app counted `gogo_partner_joined` on every re-entry and inflated the invite →
 * join funnel. Contract 1.0.0-alpha.49 adds `alreadyMember`: a join counts only
 * when it is `false`. A response without the field comes from an older server
 * and is unknown, not `false`, so it is not counted either.
 *
 * The guest join has no such field and keeps its own event.
 *
 * Every binding a jest.mock factory touches must be `mock`-prefixed.
 */
const mockReplace = jest.fn()
const mockJoinRoom = jest.fn()
const mockJoinAsGuest = jest.fn()
const mockTrack = jest.fn()
const mockSession = { status: 'user' }

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useNavigation: () => ({ isFocused: () => true }),
  useLocalSearchParams: () => ({ inviteCode: 'YDi_00PB1z4FSQZjpLbgdw' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({
    status: mockSession.status,
    joinAsGuest: (...args: unknown[]) => mockJoinAsGuest(...args),
  }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useJoinRoom: () => ({ mutateAsync: (...args: unknown[]) => mockJoinRoom(...args), isPending: false }),
}))
jest.mock('@/shared/store/recentRoomsStore', () => ({
  useRecentRoomsStore: (select: (state: { forget: (id: string) => void }) => unknown) => select({ forget: jest.fn() }),
}))
jest.mock('@/shared/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }))

import GuestJoinScreen from '@/features/gogo-room/guest-join.view'
import JoinByCodeScreen from '@/features/gogo-room/join-by-code.view'

const CODE = 'YDi_00PB1z4FSQZjpLbgdw'
const ROOM = '311f5bd8-f853-4ced-af68-e04398d1451a'
const JOIN = 'Tham gia 🙌'

const joined = () => mockTrack.mock.calls.filter(([name]) => name === 'gogo_partner_joined')

async function joinByCode() {
  const view = await renderScreen(<JoinByCodeScreen />)
  await fireEvent.changeText(view.getByLabelText('Mã mời'), CODE)
  await fireEvent.press(view.getByText(JOIN))
  await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  return view
}

async function joinFromInvite() {
  const view = await renderScreen(<GuestJoinScreen />)
  await fireEvent.press(view.getByText(JOIN))
  await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  return view
}

const member = (extra: Record<string, unknown>) => ({ roomId: ROOM, memberId: 'member-1', role: 'member', ...extra })

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.status = 'user'
})

describe.each([
  ['typed code', joinByCode],
  ['invite link', joinFromInvite],
])('signed-in join by %s', (_entry, join) => {
  it('counts a new membership once', async () => {
    mockJoinRoom.mockResolvedValue(member({ alreadyMember: false }))
    await join()
    expect(joined()).toEqual([['gogo_partner_joined', { role: 'member' }]])
  })

  it('does not count a member reopening the invite', async () => {
    mockJoinRoom.mockResolvedValue(member({ alreadyMember: true }))
    await join()
    expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}`)
    expect(joined()).toEqual([])
  })

  it('does not count the host reopening their own invite', async () => {
    mockJoinRoom.mockResolvedValue(member({ role: 'host', alreadyMember: true }))
    await join()
    expect(joined()).toEqual([])
  })

  it('treats a server that does not send the flag as unknown, not as a new join', async () => {
    mockJoinRoom.mockResolvedValue(member({}))
    await join()
    expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}`)
    expect(joined()).toEqual([])
  })
})

it('still counts a guest join, which carries no such flag', async () => {
  mockSession.status = 'anonymous'
  mockJoinAsGuest.mockResolvedValue({ kind: 'guest', roomId: ROOM })
  const view = await renderScreen(<JoinByCodeScreen />)
  await fireEvent.changeText(view.getByLabelText('Mã mời'), CODE)
  await fireEvent.changeText(view.getByLabelText('Tên hiển thị'), 'Lan')
  await fireEvent.press(view.getByText(JOIN))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM}/preference`))
  expect(joined()).toEqual([['gogo_partner_joined', { role: 'guest' }]])
})
