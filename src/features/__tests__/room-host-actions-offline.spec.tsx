import { onlineManager, QueryClient } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

import { render } from '@/shared/ui/__tests__/query-render'
import type { StoredInvite } from '@/shared/storage/invite-codes'
import i18n from '@/shared/i18n'
import { roomFor } from './harness'

const mockRefetch = jest.fn()
const mockCreate = jest.fn()
const mockForget = jest.fn()
const mockShare = jest.fn()
const mockPending = jest.fn()
const mockHold = jest.fn(() => jest.fn())
let mockStored: StoredInvite | null
let mockMetadata: unknown
let mockPaused: boolean
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('@/features/gogo-room/invite-share', () => ({ shareRoomInvite: (...args: unknown[]) => mockShare(...args) }))
jest.mock('@/features/gogo-room/prepare-room-invite', () => ({ pendingRoomInvite: (...args: unknown[]) => mockPending(...args) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoomInvites: () => ({ data: mockMetadata, dataUpdatedAt: 0, isFetching: false,
    isPending: mockMetadata === undefined, isPaused: mockPaused, isError: false, refetch: mockRefetch }),
  useCreateRoomInvite: () => ({ stored: mockStored, forget: mockForget, mutateAsync: mockCreate }),
  useRevokeRoomInvite: () => ({ mutateAsync: jest.fn() }),
  useTransitionRoom: () => ({ mutate: jest.fn() }),
}))

import { useRoomHostActions } from '@/features/gogo-room/room-host-actions.view'

const NOW = Date.parse('2026-11-12T00:00:00Z')
const EXPIRY = NOW + 60_000
const never = () => new Promise<never>(() => {})
const stored = (): StoredInvite => ({ roomId: 'room-1', inviteId: 'device-invite', code: 'device-secret',
  userId: 'user-1', savedAt: NOW - 1, expiresAt: new Date(EXPIRY).toISOString() })
function Harness() {
  const actions = useRoomHostActions(roomFor('group-host'), 'room-1', mockHold)
  return <>{actions.headerAction}{actions.feedback}{actions.group}{actions.dialogs}</>
}
let client: QueryClient
let network: jest.SpyInstance
let reducedMotion: jest.SpyInstance
const actionMocks = [mockRefetch, mockCreate, mockForget, mockShare, mockPending, mockHold]
beforeEach(() => {
  jest.useFakeTimers({ legacyFakeTimers: false, now: NOW })
  actionMocks.forEach(mock => mock.mockReset())
  mockHold.mockImplementation(() => jest.fn())
  // Keep decorative animation frames out of the 15-second deadline advance.
  // Under worker contention, advancing thousands of frames can hit Jest's timeout.
  reducedMotion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  // The app's NetInfo equivalent: expo-network feeds this synchronous signal.
  network = jest.spyOn(onlineManager, 'isOnline').mockReturnValue(true)
  onlineManager.setOnline(true)
  mockStored = null; mockMetadata = []; mockPaused = false
  mockPending.mockReturnValue(undefined)
  mockRefetch.mockResolvedValue({ data: [], isError: false })
  mockCreate.mockResolvedValue({ code: 'new-secret', expiresAt: new Date(NOW + 120_000).toISOString() })
  mockShare.mockResolvedValue('shared')
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
})
afterEach(async () => {
  try {
    await cleanup()
  } finally {
    client.clear()
    onlineManager.setOnline(true)
    network.mockRestore()
    reducedMotion.mockRestore()
    jest.clearAllTimers()
    jest.useRealTimers()
    actionMocks.forEach(mock => mock.mockReset())
    mockStored = null; mockMetadata = undefined; mockPaused = false
  }
})
async function openOffline(withCode = false) {
  network.mockReturnValue(false)
  onlineManager.setOnline(false)
  mockPaused = true
  mockStored = withCode ? stored() : null
  if (withCode) mockMetadata = undefined
  await render(<Harness />, client)
}
async function press() { await act(async () => { await fireEvent.press(screen.getByTestId('room-lobby-invite')) }) }
async function advance(ms: number) { await act(async () => { await jest.advanceTimersByTimeAsync(ms) }) }
function idle() { expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull() }

it('F-20: cached metadata without a code fails offline before mounting an overlay or refetching', async () => {
  mockMetadata = [{ inviteId: 'other-device', expiresAt: new Date(EXPIRY).toISOString() }]
  mockRefetch.mockImplementation(never)
  await openOffline()
  await press()
  idle()
  expect(screen.getByText(i18n.t('common.offlineBody'))).toBeTruthy()
  expect(mockRefetch).not.toHaveBeenCalled()
  expect(mockCreate).not.toHaveBeenCalled()
})
it('F-20: immediately shares a valid stored code offline without reading metadata', async () => {
  await openOffline(true)
  await press()
  idle()
  expect(mockShare).toHaveBeenCalledWith('device-secret', expect.any(String))
  expect(mockRefetch).not.toHaveBeenCalled()
  expect(mockCreate).not.toHaveBeenCalled()
})
it('F-20: keeps a still-valid stored fallback shareable when the metadata read times out', async () => {
  mockStored = stored(); mockMetadata = undefined; mockPaused = true
  mockRefetch.mockImplementation(never)
  await render(<Harness />, client)
  await press(); await advance(15_001)
  idle()
  expect(mockShare).toHaveBeenCalledWith('device-secret', expect.any(String))
  expect(mockCreate).not.toHaveBeenCalled()
})
it.each(['stalled read', 'connection lost'] as const)('F-20: bounds a %s and releases the overlay and tap lock', async reason => {
  mockRefetch.mockImplementation(never)
  await render(<Harness />, client)
  await press()
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  if (reason === 'connection lost') network.mockReturnValue(false)
  await advance(15_001)
  idle()
  expect(mockCreate).not.toHaveBeenCalled()
  network.mockReturnValue(true)
  mockRefetch.mockResolvedValue({ data: [], isError: false })
  await press()
  expect(mockShare).toHaveBeenCalledWith('new-secret', expect.any(String))
})
it('F-20: a stalled preparation also releases the overlay without racing a second create', async () => {
  mockPending.mockImplementation(never)
  await render(<Harness />, client)
  await press(); await advance(15_001)
  idle()
  expect(mockCreate).not.toHaveBeenCalled()
  expect(mockRefetch).not.toHaveBeenCalled()
})
it('F-20: a stalled final refresh cannot keep a successful create behind the overlay', async () => {
  mockRefetch.mockResolvedValueOnce({ data: [], isError: false }).mockImplementation(never)
  await render(<Harness />, client)
  await press(); await advance(15_001)
  idle()
  expect(mockShare).toHaveBeenCalledWith('new-secret', expect.any(String))
})
it('F-21: the stored code expires on an offline cold start even without metadata', async () => {
  await openOffline(true)
  await advance(60_001)
  expect(screen.queryByText(i18n.t('guestJoin.expiredTitle'))).toBeNull()
  expect(mockForget).toHaveBeenCalledWith('device-invite')
  mockStored = null
  await screen.rerender(<Harness />)
  expect(screen.queryByText(i18n.t('guestJoin.expiredTitle'))).toBeNull()
  await press()
  expect(mockShare).not.toHaveBeenCalled()
  expect(mockCreate).not.toHaveBeenCalled()
  expect(screen.getByText(i18n.t('common.offlineBody'))).toBeTruthy()
  idle()
})
it('F-21: revalidates expiry at tap time before the expiry timer has run', async () => {
  await openOffline(true)
  jest.setSystemTime(EXPIRY + 1)
  await press()
  expect(mockShare).not.toHaveBeenCalled()
  expect(screen.getByText(i18n.t('common.offlineBody'))).toBeTruthy()
  idle()
})
it('F-21: an expired fallback is never shared after metadata fails', async () => {
  mockStored = stored(); mockMetadata = undefined; mockPaused = true
  mockRefetch.mockImplementation(async () => {
    jest.setSystemTime(EXPIRY + 1)
    return { isError: true }
  })
  await render(<Harness />, client)
  await press()
  expect(mockShare).not.toHaveBeenCalled()
  expect(screen.getByText(i18n.t('gogoRoom.inviteFailed'))).toBeTruthy()
  idle()
})
it('F-21: creates a fresh link when the stored code expired and online metadata confirms no active invite', async () => {
  mockStored = stored(); mockMetadata = undefined; mockPaused = true
  await render(<Harness />, client)
  jest.setSystemTime(EXPIRY + 1)
  await press()
  expect(mockShare).toHaveBeenCalledWith('new-secret', expect.any(String))
  expect(mockShare).not.toHaveBeenCalledWith('device-secret', expect.any(String))
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('room-lobby-invite-confirm')).toBeNull()
  idle()
})
