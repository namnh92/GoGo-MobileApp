import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { renderScreen } from './harness'
import { restoreRoomDraft, saveRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import i18n from '@/shared/i18n'
import { surface, text } from '@/shared/ui/tokens'
import { useWizardActions } from '@/features/create-date/wizard-actions.view'
import { GhostBtn } from '@/shared/ui/button.view'
import { roomScheduleRange } from '@/features/gogo-room/room-schedule'

function DraftExit() {
  const { actions, close } = useWizardActions({ step: 'time' })
  return <><GhostBtn label="Back" onPress={() => void close()} />{actions}</>
}

const mockPush = jest.fn()
const mockDismiss = jest.fn()
let mockOwner = 'owner'
const mockQuery = {
  data: { pages: [{ items: [{ id: 'room', title: 'Live room', type: 'group', status: 'collecting', participantCount: 3 }] }] },
  isPending: false, isError: false, isPaused: false, isFetching: false, hasNextPage: false,
  refetch: jest.fn(), fetchNextPage: jest.fn(), error: null,
}
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, dismissTo: mockDismiss }), useLocalSearchParams: () => ({}), useFocusEffect: () => undefined }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: mockOwner } }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: () => mockQuery }))

import PlansScreen from '@/features/tabs/plans.view'

beforeEach(async () => {
  jest.clearAllMocks()
  await i18n.changeLanguage('vi')
  mockOwner = 'owner'
  mockQuery.data.pages[0].items = [{ id: 'room', title: 'Live room', type: 'group', status: 'collecting', participantCount: 3 }]
  mockQuery.isPending = false
  mockQuery.isError = false
  useRoomStore.getState().resetDraft()
  useSavedRoomDraft.setState({ draft: null })
})
afterEach(async () => { await i18n.changeLanguage('vi') })

async function save(audience: 'couple' | 'group-host' = 'group-host') {
  useRoomStore.setState({ audience, participantCount: 7, title: 'Draft dinner', budgetMode: 'total', budgetAmount: 2100000,
    startAt: '2030-12-12T12:00:00Z', startTime: '19:00', endAt: '2030-12-12T14:00:00Z', endTime: '21:00', scheduleDay: '2030-12-12' })
  await act(async () => { await saveRoomDraft('owner', 'budget') })
}

it.each(['couple', 'group-host'] as const)('draft is the first shared PlanCard with neutral text status and actual facts (%s)', async audience => {
  await save(audience)
  // Couple wizard amounts are totals even when the persisted store default is per_person.
  if (audience === 'couple') useSavedRoomDraft.setState(state => ({ draft: { ...state.draft!, fields: { ...state.draft!.fields, budgetMode: 'per_person' } } }))
  const view = await renderScreen(<PlansScreen />)
  const card = view.getByTestId('plan-card-draft')
  const content = within(card)
  const pill = content.getByText('Bản nháp')
  expect(StyleSheet.flatten(pill.props.style).color).toBe(text.primary)
  expect(StyleSheet.flatten(pill.parent!.props.style).backgroundColor).toBe(surface.card)
  expect(content.getByTestId('plan-card-title')).toHaveTextContent('Draft dinner')
  expect(content.getByTestId('plan-card-meta')).toHaveTextContent(audience === 'couple' ? /cho 2 người · 2,1tr tổng/ : /7 người · 2,1tr tổng/)
  expect(content.getByTestId('plan-card-meta')).toHaveTextContent(/2030/)
  expect(view.getAllByTestId(/^plan-card-(draft|room)$/)[0]).toBe(card)
  expect(view.queryByText('Tiếp tục nháp')).toBeNull()
  await fireEvent.press(card)
  expect(mockPush.mock.calls).toEqual([[{ pathname: '/create/type', params: { resumeStep: 'budget' } }]])
  expect(useRoomStore.getState().title).toBe('Draft dinner')
})

it.each(['vi', 'en'])('F-14: Back exit-save after returning to time shows current inputs over stale instants (%s)', async locale => {
  await save()
  await i18n.changeLanguage(locale)
  restoreRoomDraft('owner')
  const oldStart = useRoomStore.getState().startAt
  // Time inputs are edited before Continue rebuilds the instants.
  useRoomStore.getState().patchDraft({ scheduleDay: '2031-01-14' })
  useRoomStore.getState().setStartTime('18:15')
  useRoomStore.getState().setEndTime('22:45')
  const header = await renderScreen(<DraftExit />)
  await fireEvent.press(header.getByRole('button', { name: 'Back' }))
  await fireEvent.press(header.getByRole('button', { name: i18n.t('draft.exitSave') }))
  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('/(tabs)'))
  expect(useSavedRoomDraft.getState().draft!.fields.startAt).toBe(oldStart)
  await header.unmount()
  const plans = await renderScreen(<PlansScreen />)
  const meta = within(plans.getByTestId('plan-card-draft')).getByTestId('plan-card-meta')
  expect(meta.props.children).toContain(new Date('2031-01-14T12:00:00').toLocaleDateString(locale))
  expect(meta.props.children).toContain('18:15 – 22:45')
  expect(meta.props.accessibilityLabel).toContain('18:15 – 22:45')
  expect(meta).not.toHaveTextContent('2030')
})

it('F-14: old drafts with only instants retain the legacy schedule display', async () => {
  await save()
  useSavedRoomDraft.setState(state => ({ draft: { ...state.draft!, fields: { ...state.draft!.fields, scheduleDay: null, startTime: null, endTime: null } } }))
  const fields = useSavedRoomDraft.getState().draft!.fields
  const range = roomScheduleRange(fields.startAt!, fields.endAt!, 'vi')!
  const view = await renderScreen(<PlansScreen />)
  expect(within(view.getByTestId('plan-card-draft')).getByTestId('plan-card-meta').props.children).toContain(`${range.start} – ${range.end}`)
})

it('draft alone suppresses empty state; blank name and unknown budget/time are omitted', async () => {
  mockQuery.data.pages[0].items = []
  await act(async () => { await saveRoomDraft('owner', 'type') })
  const view = await renderScreen(<PlansScreen />)
  const card = within(view.getByTestId('plan-card-draft'))
  expect(card.getByText('Kèo chưa đặt tên')).toBeTruthy()
  expect(card.getByTestId('plan-card-meta')).toHaveTextContent('cho 2 người', { exact: true })
  expect(view.queryByText(i18n.t('plans.emptyTitle'))).toBeNull()
  expect(view.queryByText(i18n.t('roomSchedule.unset'))).toBeNull()
  await fireEvent.press(view.getByRole('tab', { name: 'Lịch sử' }))
  expect(view.queryByTestId('plan-card-draft')).toBeNull()
  expect(view.getByText(i18n.t('plans.emptyTitle'))).toBeTruthy()
})

it.each(['pending', 'error'] as const)('local draft stays available when rooms are %s', async state => {
  await save()
  mockQuery.data.pages[0].items = []
  mockQuery.isPending = state === 'pending'
  mockQuery.isError = state === 'error'
  const view = await renderScreen(<PlansScreen />)
  expect(view.getByTestId('plan-card-draft')).toBeTruthy()
  expect(view.queryByText(i18n.t('plans.emptyTitle'))).toBeNull()
})

it('delete is a separate 48pt button; warning cancel keeps draft and confirm removes memory/disk', async () => {
  await save()
  mockQuery.data.pages[0].items = []
  const view = await renderScreen(<PlansScreen />)
  const remove = view.getByRole('button', { name: i18n.t('draft.delete') })
  expect(StyleSheet.flatten(remove.props.style).width).toBeGreaterThanOrEqual(44)
  expect(StyleSheet.flatten(remove.props.style).height).toBeGreaterThanOrEqual(44)
  await fireEvent.press(remove)
  expect(mockPush).not.toHaveBeenCalled()
  expect(view.getByTestId('draft-delete-sheet')).toBeTruthy()
  expect(useSavedRoomDraft.getState().draft).not.toBeNull()
  await fireEvent.press(view.getByRole('button', { name: 'Huỷ' }))
  expect(useSavedRoomDraft.getState().draft).not.toBeNull()
  await fireEvent.press(remove)
  await fireEvent.press(within(view.getByTestId('draft-delete-sheet')).getByRole('button', { name: i18n.t('draft.delete') }))
  expect(useSavedRoomDraft.getState().draft).toBeNull()
  expect(await AsyncStorage.getItem('gogo.room-draft.v1')).toBeNull()
  expect(view.queryByTestId('plan-card-draft')).toBeNull()
  expect(view.getByText(i18n.t('plans.emptyTitle'))).toBeTruthy()
  expect(mockPush).not.toHaveBeenCalled()
})

it('no saved draft means no card', async () => {
  const view = await renderScreen(<PlansScreen />)
  expect(view.queryByTestId('plan-card-draft')).toBeNull()
})

it('another account cannot see, resume or delete the saved draft', async () => {
  await save()
  mockOwner = 'other'
  const view = await renderScreen(<PlansScreen />)
  expect(view.queryByTestId('plan-card-draft')).toBeNull()
  expect(view.queryByRole('button', { name: i18n.t('draft.delete') })).toBeNull()
})

it('English uses the Draft status', async () => {
  await save()
  await i18n.changeLanguage('en')
  const view = await renderScreen(<PlansScreen />)
  expect(within(view.getByTestId('plan-card-draft')).getByText('Draft')).toBeTruthy()
})

it('omits unknown time while keeping a known per-person budget and partial day/clock', async () => {
  useRoomStore.setState({ audience: 'group-host', participantCount: 6, budgetAmount: 300000, budgetMode: 'per_person',
    scheduleDay: '2030-12-12', startTime: '19:30', startAt: null })
  await act(async () => { await saveRoomDraft('owner', 'time') })
  const view = await renderScreen(<PlansScreen />)
  const meta = within(view.getByTestId('plan-card-draft')).getByTestId('plan-card-meta')
  expect(meta).toHaveTextContent(/6 người · 300k\/người · .*2030.*19:30/)
  expect(meta.props.accessibilityLabel).toContain('Ngân sách 300k mỗi người')
})

it('switching accounts while confirmation is open removes the draft UI and keeps the other snapshot', async () => {
  await save()
  const view = await renderScreen(<PlansScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('draft.delete') }))
  mockOwner = 'other'
  await view.rerender(<PlansScreen />)
  expect(view.queryByTestId('plan-card-draft')).toBeNull()
  expect(view.queryByTestId('draft-delete-sheet')).toBeNull()
  expect(useSavedRoomDraft.getState().draft?.ownerId).toBe('owner')
})

it('an older delete confirmation cannot remove a replacement snapshot', async () => {
  await save()
  const view = await renderScreen(<PlansScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('draft.delete') }))
  await act(async () => {
    useRoomStore.setState({ title: 'Replacement draft' })
    await saveRoomDraft('owner', 'mood')
  })
  await fireEvent.press(within(view.getByTestId('draft-delete-sheet')).getByRole('button', { name: i18n.t('draft.delete') }))
  expect(useSavedRoomDraft.getState().draft?.fields.title).toBe('Replacement draft')
  expect(await AsyncStorage.getItem('gogo.room-draft.v1')).toContain('Replacement draft')
})
