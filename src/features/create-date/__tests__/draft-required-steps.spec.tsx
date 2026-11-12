import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { render } from '@/shared/ui/__tests__/query-render'
import { loadRoomDraft, restoreRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import i18n from '@/shared/i18n'
import CreateBudget from '../create-budget.view'
import CreatePlaces from '../create-places.view'
import CreateTime from '../create-time.view'

const mockPush = jest.fn()
const mockCreate = jest.fn()
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined, useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/features/gogo-room/prepare-room-invite', () => ({ prepareRoomInvite: jest.fn(async () => undefined) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: null }),
  useCreateRoom: () => ({ isPending: false, mutateAsync: mockCreate }),
}))

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 10) })
  jest.clearAllMocks()
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
  mockCreate.mockResolvedValue({ id: 'created', type: 'group', decisionMode: 'vote' })
  await i18n.changeLanguage('vi')
})
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers() })
  jest.useRealTimers()
})

async function resume(step: 'group-setup' | 'mood', fields = {}) {
  // Actual v1 disk decode, migration and restore; group-setup preceded time.
  await AsyncStorage.setItem('gogo.room-draft.v1', JSON.stringify({
    version: 1, ownerId: 'owner', step,
    fields: { ...useRoomStore.getState(), areaKey: null, audience: 'group-host', budgetAmount: 300000, ...fields },
  }))
  await loadRoomDraft('owner')
  const landing = restoreRoomDraft('owner')
  expect(landing).toBe(step === 'group-setup' ? 'budget' : 'places')
  return render(landing === 'budget' ? <CreateBudget /> : <CreatePlaces />)
}
const next = () => fireEvent.press(screen.getByRole('button', { name: i18n.t('common.continue') }))
const create = () => fireEvent.press(screen.getByRole('button', { name: i18n.t('createPlaces.cta') }))

it.each(['group-setup', 'mood'] as const)('F-23: legacy %s without time must complete time before it can create', async step => {
  const view = await resume(step)
  if (step === 'group-setup') await next()
  else await create()
  expect(mockPush).toHaveBeenLastCalledWith('/create/time')
  expect(mockCreate).not.toHaveBeenCalled()
  expect(useRoomStore.getState().creationAttempt).toBeNull()

  await view.rerender(<CreateTime />)
  expect(screen.getByRole('button', { name: i18n.t('common.continue') })).toBeDisabled()
  await next()
  expect(mockCreate).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId('create-time-start-row'))
  await fireEvent.press(screen.getByTestId('start-time-sheet-wheel-hours-19'))
  await fireEvent.press(screen.getByTestId('start-time-sheet-wheel-minutes-00'))
  await fireEvent.press(screen.getByRole('button', { name: 'Xong' }))
  await next()
  expect(mockPush).toHaveBeenLastCalledWith('/create/budget')
  await view.rerender(<CreateBudget />)
  await next()
  expect(mockPush).toHaveBeenLastCalledWith('/create/places')
  await view.rerender(<CreatePlaces />)
  await create()
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
  expect(mockCreate.mock.calls[0][0]).toMatchObject({ type: 'group', participantCount: 4,
    constraint: { budgetAmount: 300000, startAt: new Date(2026, 10, 12, 19).toISOString() } })
})

it.each([
  [{ startTime: null, startAt: null, budgetAmount: null }, '/create/time'],
  [{ budgetAmount: null }, '/create/budget'],
  [{ participantCount: 2 }, '/create/budget'],
  [{ participantCount: 13 }, '/create/budget'],
  [{ startAt: null }, '/create/time'],
  [{ startTime: '09:00', startAt: new Date(2026, 10, 12, 9).toISOString() }, '/create/time'],
] as const)('F-23: legacy mood sends invalid earlier fields %j to the first invalid step', async (fields, route) => {
  await resume('mood', { startTime: '19:00', startAt: new Date(2026, 10, 12, 19).toISOString(), ...fields })
  await create()
  expect(mockCreate).not.toHaveBeenCalled()
  expect(mockPush).toHaveBeenLastCalledWith(route)
  expect(useRoomStore.getState().creationPending).toBe(false)
})

it('F-23: budget Continue sends the first invalid step back before a later invalid time', async () => {
  await resume('group-setup')
  await act(async () => { useRoomStore.setState({ title: 'x'.repeat(81) }) })
  await next()
  expect(mockPush).toHaveBeenLastCalledWith('/create/type')
  expect(mockCreate).not.toHaveBeenCalled()
})

it('F-24: wizard increments one at a time up to 12 and never clamps an oversized draft on decrement', async () => {
  useRoomStore.setState({ audience: 'group-host', participantCount: 11 })
  await render(<CreateBudget />)
  const increase = () => screen.getByRole('button', { name: i18n.t('groupSetup.increase') })
  await fireEvent.press(increase())
  expect(useRoomStore.getState().participantCount).toBe(12)
  expect(increase()).toBeDisabled()
  await fireEvent.press(increase())
  expect(useRoomStore.getState().participantCount).toBe(12)
  await act(async () => { useRoomStore.setState({ participantCount: 15 }) })
  expect(increase()).toBeDisabled()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('groupSetup.decrease') }))
  expect(useRoomStore.getState().participantCount).toBe(14)
})
