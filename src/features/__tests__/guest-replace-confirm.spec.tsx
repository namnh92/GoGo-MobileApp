import { act, fireEvent } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'

import { renderScreen } from './harness'

/**
 * #272 — a guest already in a room who opens another invite (link or typed
 * code) went straight through `joinAsGuest`, which purges the current guest
 * session before joining: room A was gone from this device without a word.
 *
 * Owner decision 2026-09-22: retain the existing guest session, and require
 * confirmation before replacing it. Recognising "this is the same room" needs
 * the backend's `alreadyMember` (GoGo-BE#607 / PR #648, not merged); that half
 * is not here.
 */

const ROOM_A = '0d7c3c1e-7a51-4b61-9f43-2a5f8c1e9a01'
const ROOM_B = '311f5bd8-f853-4ced-af68-e04398d1451a'
const CODE = 'YDi_00PB1z4FSQZjpLbgdw'

const mockReplace = jest.fn()
const mockJoinAsGuest = jest.fn()
const mockSession = { status: 'guest', guestRoomId: ROOM_A as string | null }

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useNavigation: () => ({ isFocused: () => true }),
  useLocalSearchParams: () => ({ inviteCode: 'YDi_00PB1z4FSQZjpLbgdw' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({
    status: mockSession.status,
    guestRoomId: mockSession.guestRoomId,
    joinAsGuest: (...args: unknown[]) => mockJoinAsGuest(...args),
  }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useJoinRoom: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))
jest.mock('@/shared/store/recentRoomsStore', () => ({
  useRecentRoomsStore: (select: (state: { forget: (id: string) => void }) => unknown) => select({ forget: jest.fn() }),
}))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))

import GuestJoinScreen from '@/features/gogo-room/guest-join.view'
import JoinByCodeScreen from '@/features/gogo-room/join-by-code.view'

const JOIN = 'Tham gia 🙌'
const NOTICE = /đang tham gia một phòng khác với tư cách khách/
const BACK_TO_ROOM = 'Về phòng của tôi'

let alertSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.status = 'guest'
  mockSession.guestRoomId = ROOM_A
  mockJoinAsGuest.mockResolvedValue({ kind: 'guest', roomId: ROOM_B })
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(() => alertSpy.mockRestore())

function lastAlertButton(style: AlertButton['style']): AlertButton {
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as AlertButton[]
  const button = buttons.find(entry => entry.style === style)
  if (!button) throw new Error(`no ${style} button in the confirmation`)
  return button
}

type Screen = 'invite link' | 'typed code'

async function fillAndJoin(screen: Screen) {
  const view = await renderScreen(screen === 'invite link' ? <GuestJoinScreen /> : <JoinByCodeScreen />)
  if (screen === 'typed code') {
    await act(async () => {
      fireEvent.changeText(view.getByLabelText('Mã mời'), CODE)
    })
  }
  await act(async () => {
    fireEvent.changeText(view.getByLabelText('Tên hiển thị'), 'Lan')
  })
  await act(async () => {
    fireEvent.press(view.getByText(JOIN))
  })
  return view
}

describe.each(['invite link', 'typed code'] as const)('a guest already in a room, via %s', screen => {
  it('is told, before anything happens, that joining replaces their guest room', async () => {
    const view = await renderScreen(screen === 'invite link' ? <GuestJoinScreen /> : <JoinByCodeScreen />)
    expect(view.getByText(NOTICE)).toBeTruthy()
  })

  it('can go back to the room they are in, keeping the session', async () => {
    const view = await renderScreen(screen === 'invite link' ? <GuestJoinScreen /> : <JoinByCodeScreen />)
    await act(async () => {
      fireEvent.press(view.getByText(BACK_TO_ROOM))
    })
    expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM_A}`)
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
  })

  it('is asked to confirm, and nothing is replaced until they do', async () => {
    await fillAndJoin(screen)
    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
  })

  it('keeps the current guest session when they decline', async () => {
    await fillAndJoin(screen)
    await act(async () => {
      lastAlertButton('cancel').onPress?.()
    })
    expect(mockJoinAsGuest).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('joins the new room once they confirm', async () => {
    await fillAndJoin(screen)
    await act(async () => {
      lastAlertButton('destructive').onPress?.()
    })
    expect(mockJoinAsGuest).toHaveBeenCalledWith({ inviteCode: CODE, displayName: 'Lan' })
    expect(mockReplace).toHaveBeenCalledWith(`/room/${ROOM_B}/preference`)
  })
})

describe.each(['invite link', 'typed code'] as const)('someone with no session, via %s', screen => {
  it('joins without a confirmation or a notice', async () => {
    mockSession.status = 'anonymous'
    mockSession.guestRoomId = null
    const view = await fillAndJoin(screen)
    expect(view.queryByText(NOTICE)).toBeNull()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(mockJoinAsGuest).toHaveBeenCalledTimes(1)
  })
})
