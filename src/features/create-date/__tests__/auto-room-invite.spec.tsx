import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { useCreateRoomDraft } from '../use-create-room-draft'
import { useRoomStore } from '@/shared/store/roomStore'
import { prepareRoomInvite, pendingRoomInvite } from '@/features/gogo-room/prepare-room-invite'
import { loadInviteCode, purgeInviteCodes } from '@/shared/storage/invite-codes'
import { sessionRoomInvite } from '@/shared/api/queries/use-rooms'
import '@/shared/i18n'

const mockCreateRoom = jest.fn()
const mockList = jest.fn()
const mockInvite = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { userId: 'owner' } }) }))
jest.mock('@/shared/api/session', () => ({ ...jest.requireActual('@/shared/api/session'), getSession: () => ({ kind: 'user', userId: 'owner' }) }))
jest.mock('@/shared/store/savedRoomDraft', () => ({ saveRoomDraft: jest.fn(async () => undefined), clearSavedRoomDraft: jest.fn(async () => undefined) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useCreateRoom: () => ({ mutateAsync: mockCreateRoom, isPending: false }) }))
jest.mock('@/shared/api/endpoints/rooms', () => ({ ...jest.requireActual('@/shared/api/endpoints/rooms'), listRoomInvites: (...args: unknown[]) => mockList(...args), createRoomInvite: (...args: unknown[]) => mockInvite(...args) }))
let client: QueryClient
const created = { id: 'room-1', type: 'couple', decisionMode: 'match' }
const expiry = '2099-01-01T00:00:00Z'
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
beforeEach(async () => {
  jest.clearAllMocks()
  await purgeInviteCodes()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  useRoomStore.getState().resetDraft()
  useRoomStore.setState({ budgetAmount: 500000 })
  mockCreateRoom.mockResolvedValue(created)
  mockList.mockResolvedValue([])
  mockInvite.mockResolvedValue({ inviteId: 'invite-1', code: 'private-code', expiresAt: expiry, maxUses: 20 })
})
afterEach(() => client.clear())
it('creates one background invite after successful creation and does not persist the code', async () => {
  const hook = await renderHook(useCreateRoomDraft, { wrapper })
  await act(async () => { await Promise.all([hook.result.current.submit(), hook.result.current.submit()]) })
  await waitFor(() => expect(mockInvite).toHaveBeenCalledTimes(1))
  await pendingRoomInvite(client, 'room-1')
  expect(mockCreateRoom).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1')
  expect(sessionRoomInvite(client, 'room-1')?.code).toBe('private-code')
  expect(await loadInviteCode('room-1', 'owner')).toBeNull()
})
it('does not delay navigation while invite metadata is still loading', async () => {
  let finish!: (value: unknown[]) => void
  mockList.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const hook = await renderHook(useCreateRoomDraft, { wrapper })
  await act(async () => { await hook.result.current.submit() })
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1')
  expect(hook.result.current.error).toBeNull()
  await act(async () => { finish([]); await pendingRoomInvite(client, 'room-1') })
})
it.each(['list', 'create'])('silently tolerates an invite %s failure after room creation', async phase => {
  if (phase === 'list') mockList.mockRejectedValue(new Error('offline'))
  else mockInvite.mockRejectedValue(new Error('offline'))
  const hook = await renderHook(useCreateRoomDraft, { wrapper })
  await act(async () => { await hook.result.current.submit() })
  await pendingRoomInvite(client, 'room-1')?.catch(() => undefined)
  expect(hook.result.current.error).toBeNull()
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1')
})
it('skips any active invite on retry/reopen and ignores expired/revoked/exhausted invites', async () => {
  mockList.mockResolvedValue([{ inviteId: 'existing', expiresAt: expiry }])
  await prepareRoomInvite(client, 'room-1')
  await prepareRoomInvite(client, 'room-1')
  expect(mockInvite).not.toHaveBeenCalled()
  mockList.mockResolvedValue([{ inviteId: 'dead', expiresAt: '2000-01-01T00:00:00Z' }, { inviteId: 'revoked', expiresAt: expiry, revoked: true }, { inviteId: 'used', expiresAt: expiry, maxUses: 1, useCount: 1 }])
  await Promise.all([prepareRoomInvite(client, 'room-1'), prepareRoomInvite(client, 'room-1')])
  expect(mockInvite).toHaveBeenCalledTimes(1)
})
it('does not create when metadata is malformed', async () => {
  mockList.mockResolvedValue({ broken: true })
  await prepareRoomInvite(client, 'room-1')
  expect(mockInvite).not.toHaveBeenCalled()
})

it('skips auto creation after a successful room retry returns an already invited room', async () => {
  mockList.mockResolvedValue([{ inviteId: 'existing', expiresAt: expiry }])
  const hook = await renderHook(useCreateRoomDraft, { wrapper })
  await act(async () => { await hook.result.current.submit() })
  await pendingRoomInvite(client, 'room-1')
  expect(mockReplace).toHaveBeenCalledWith('/room/room-1')
  expect(mockInvite).not.toHaveBeenCalled()
})
