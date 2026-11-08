import { act, fireEvent, screen, within, waitFor } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { createNavigationContainerRef, createNavigatorFactory, NavigationContainer, StackActions, StackRouter, useNavigationBuilder } from '@react-navigation/native'
import { renderScreen } from './harness'
import { completeWizard } from './contribution-fixtures'
import { themes } from '@/shared/ui/theme'
import i18n from '@/shared/i18n'
import { ApiError, NetworkError } from '@/shared/api/errors'
import type { ContributionDraft } from '@/features/place-import/contribution-form'

const mockRead = jest.fn()
const mockSave = jest.fn()
const mockRemove = jest.fn()
const mockList = jest.fn()
const mockSubmit = jest.fn()
const mockResolution = { status: 'RESOLVED', candidate: { googlePlaceId: 'place-a', name: 'Test café' } }
const mockResolve = { reset: jest.fn(), mutate: jest.fn((_body, callbacks) => callbacks.onSuccess(mockResolution)), isPending: false }
const navigation = createNavigationContainerRef()
jest.mock('expo-router', () => ({
  useNavigation: () => jest.requireActual('@react-navigation/native').useNavigation(),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  ...jest.requireActual('./contribution-fixtures').contributionHooks(),
  useResolveGoogleMapsLink: () => mockResolve,
  listContributionDrafts: () => mockList(),
  getContributionDraft: (id: string) => mockRead(id),
  saveContributionDraft: (id: string, body: unknown) => mockSave({ id, body }),
  deleteContributionDraft: (id: string, version: number) => mockRemove({ id, version }),
  submitPlace: (body: unknown) => mockSubmit(body),
}))
import PlaceImportScreen from '@/features/place-import/import.view'

// Real navigation state and usePreventRemove; the custom renderer needs no native stack runtime.
function Navigator(props: { children: React.ReactNode; initialRouteName?: string }) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, props)
  return <NavigationContent>{state.routes.map(route => <View key={route.key}>{descriptors[route.key].render()}</View>)}</NavigationContent>
}
const Stack = createNavigatorFactory(Navigator)()
const draft: ContributionDraft = { id: 'draft-a', googlePlaceId: 'place-a', version: 1,
  enrichment: {}, expiresAt: '2027-01-01T00:00:00Z', updatedAt: '2026-11-07T00:00:00Z', verificationStatus: 'unverified' }
const button = (name: string) => screen.getByRole('button', { name })
async function preview() {
  await renderScreen(<NavigationContainer ref={navigation} initialState={{ index: 1, routes: [{ name: 'Home' }, { name: 'Import' }] }}>
    <Stack.Navigator><Stack.Screen name="Home">{() => <View testID="home" />}</Stack.Screen><Stack.Screen name="Import" component={PlaceImportScreen} /></Stack.Navigator>
  </NavigationContainer>)
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'https://maps.app.goo.gl/A')
  await fireEvent.press(button('Tiếp tục trích xuất thông tin'))
}
const exit = () => within(screen.getByTestId('contribution-exit'))
async function headerBack() { await fireEvent.press(within(screen.getByTestId('import-header')).getByRole('button', { name: 'Quay lại' })) }
async function dirty() { await fireEvent.press(button('Cặp đôi')) }
const row = () => within(screen.getByTestId('contribution-action-bar')).getByTestId('sheet-actions')
beforeEach(async () => {
  jest.clearAllMocks(); mockSave.mockReset()
  await i18n.changeLanguage('vi')
  mockList.mockResolvedValue({ items: [] })
  mockSave.mockImplementation(({ id, body }) => {
    const saved = { ...draft, id, enrichment: body.enrichment, version: body.expectedVersion + 1 }
    mockList.mockResolvedValue({ items: [saved] }); mockRead.mockResolvedValue(saved)
    return Promise.resolve(saved)
  })
  mockSubmit.mockResolvedValue({ status: 'PENDING' })
})

it.each(['orange'] as const)('keeps one fixed shared row outside the scroll view at every step (%s)', async themeName => {
  UnistylesSheet.configure({ themes: { [themeName]: themes[themeName] } as typeof themes })
  try {
    await preview()
    expect(within(screen.getByTestId('import-scroll')).queryByTestId('contribution-action-bar')).toBeNull()
    expect(StyleSheet.flatten(row().props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' })
    expect(within(row()).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['Lưu nháp', 'Tiếp tục'])
    await dirty(); await fireEvent.press(button('Tiếp tục'))
    expect(within(row()).getAllByRole('button').map(b => b.props.accessibilityLabel)).toEqual(['Quay lại', 'Lưu nháp', 'Tiếp tục'])
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sôi động' })); await fireEvent.press(button('Tiếp tục'))
    const actions = within(row()).getAllByRole('button')
    expect(actions.map(b => b.props.accessibilityLabel)).toEqual(['Quay lại', 'Lưu nháp', 'Gửi'])
    for (const action of actions) expect(StyleSheet.flatten(action.props.style)).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0 })
    expect(within(screen.getByTestId('contribution-wizard')).queryByTestId('sheet-actions')).toBeNull()
  } finally { UnistylesSheet.configure({ themes }) }
})

it('leaves clean forms through header or native back without prompting', async () => {
  await preview(); await headerBack()
  expect(screen.queryByTestId('contribution-exit')).toBeNull()
  await waitFor(() => expect(screen.queryByTestId('contribution-wizard')).toBeNull())
  await fireEvent.changeText(screen.getByTestId('import-link-input'), 'https://maps.app.goo.gl/A')
  await fireEvent.press(button('Tiếp tục trích xuất thông tin'))
  await act(async () => navigation.goBack())
  expect(screen.queryByTestId('import-header')).toBeNull()
  expect(screen.queryByTestId('contribution-exit')).toBeNull()
})

it.each(['header', 'swipe', 'hardware'] as const)('cancels %s back, preserving edits and the current step', async source => {
  await preview(); await completeWizard()
  await fireEvent.changeText(screen.getByLabelText('Món ngon & mẹo'), 'Keep these tips')
  if (source === 'header') await headerBack()
  else await act(async () => { if (source === 'swipe') navigation.dispatch(StackActions.pop()); else navigation.goBack() })
  expect(exit().getByText(i18n.t('placeWizard.exit.body'))).toBeTruthy()
  expect(StyleSheet.flatten(exit().getByTestId('sheet-actions').props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'nowrap' })
  expect(exit().getAllByRole('button').filter(b => ['Huỷ', 'Không lưu', 'Lưu nháp'].includes(b.props.accessibilityLabel))).toHaveLength(3)
  await fireEvent.press(exit().getByRole('button', { name: 'Huỷ' }))
  expect(screen.getByLabelText('Món ngon & mẹo').props.value).toBe('Keep these tips')
  expect(mockSave).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled()
})

it.each(['header', 'swipe', 'hardware'] as const)('discards only local edits on %s back without deleting a remote draft', async source => {
  mockList.mockResolvedValue({ items: [draft] }); mockRead.mockResolvedValue(draft)
  await preview(); await fireEvent.press(button('Tiếp tục bản nháp'))
  await fireEvent.press(within(screen.getByTestId('contribution-feedback')).getByRole('button', { name: 'Đóng' }))
  await dirty()
  if (source === 'header') await headerBack()
  else await act(async () => { if (source === 'swipe') navigation.dispatch(StackActions.pop()); else navigation.goBack() })
  await act(async () => { await fireEvent.press(exit().getByRole('button', { name: 'Không lưu' })) })
  await waitFor(() => expect(screen.queryByTestId('contribution-wizard')).toBeNull())
  expect(mockSave).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled()
  if (source !== 'header') expect(screen.queryByTestId('import-header')).toBeNull()
  await screen.unmount()
})

it.each(['header', 'swipe', 'hardware'] as const)('waits for successful save before leaving through %s back', async source => {
  let finish!: (draft: ContributionDraft) => void
  mockSave.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await preview(); await dirty()
  if (source === 'header') await headerBack()
  else await act(async () => { if (source === 'swipe') navigation.dispatch(StackActions.pop()); else navigation.goBack() })
  await act(async () => { await fireEvent.press(exit().getByRole('button', { name: 'Lưu nháp' })) })
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('contribution-wizard')).toBeTruthy()
  expect(screen.queryByTestId('contribution-feedback')).toBeNull()
  const { id, body } = mockSave.mock.calls[0][0]
  await act(async () => {
    const saved = { ...draft, id, enrichment: body.enrichment }
    mockList.mockResolvedValue({ items: [saved] }); mockRead.mockResolvedValue(saved); finish(saved)
  })
  await waitFor(() => expect(screen.queryByTestId('contribution-wizard')).toBeNull())
  expect(mockRemove).not.toHaveBeenCalled()
  await screen.unmount()
})

it.each([new NetworkError(), new ApiError(409, { code: 'DRAFT_MODIFIED', message: 'changed' })])('stays with edits and recovery after an unsuccessful save-and-leave', async error => {
  mockSave.mockRejectedValueOnce(error)
  await preview(); await dirty(); await headerBack()
  await act(async () => { await fireEvent.press(exit().getByRole('button', { name: 'Lưu nháp' })) })
  expect(screen.getByTestId('contribution-wizard')).toBeTruthy()
  expect(screen.queryByTestId('import-link-input')).toBeNull()
  await waitFor(() => expect(screen.getByTestId('contribution-exit-failure')).toBeTruthy())
  expect(mockRemove).not.toHaveBeenCalled()
  await fireEvent.press(within(screen.getByTestId('contribution-exit-failure')).getByRole('button', { name: 'Đóng' }))
  expect(screen.queryByTestId('contribution-feedback')).toBeNull()
  const recovery = error instanceof ApiError ? 'Tạo bản mới với thông tin khác của tôi' : 'Kiểm tra lần lưu'
  expect(button(recovery).props.accessibilityState.disabled).toBe(false)
  // A repeat Save while the conflict guard is active still explains why it cannot leave.
  if (error instanceof ApiError) {
    await headerBack()
    await fireEvent.press(exit().getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(screen.getByTestId('contribution-exit-failure')).toBeTruthy())
  }
})

it('omits local discard and new-draft status; repeats feedback for each successful save', async () => {
  await preview()
  expect(screen.queryByRole('button', { name: 'Bỏ bản nháp cục bộ' })).toBeNull()
  expect(screen.queryByText('Bản nháp mới.')).toBeNull()
  expect(screen.queryByTestId('contribution-feedback')).toBeNull()
  for (let n = 0; n < 2; n++) {
    await fireEvent.press(button('Lưu nháp'))
    await waitFor(() => expect(screen.getByTestId('contribution-feedback')).toBeTruthy())
    const feedback = within(screen.getByTestId('contribution-feedback'))
    expect(feedback.getByText('Đã lưu bản nháp.')).toBeTruthy()
    await fireEvent.press(feedback.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByText('Đã lưu bản nháp.')).toBeNull()
  }
  expect(mockSave).toHaveBeenCalledTimes(2)
})


it('stays when Android back dismisses the exit sheet', async () => {
  await preview(); await dirty(); await headerBack()
  await fireEvent(screen.getByTestId('contribution-exit-modal'), 'requestClose')
  await waitFor(() => expect(screen.queryByTestId('contribution-exit')).toBeNull())
  expect(button('Cặp đôi').props.accessibilityState.selected).toBe(true)
  expect(mockSave).not.toHaveBeenCalled(); expect(mockRemove).not.toHaveBeenCalled()
})

it('leaves a saved clean form without asking to save again', async () => {
  await preview(); await dirty(); await fireEvent.press(button('Lưu nháp'))
  await waitFor(() => expect(screen.getByTestId('contribution-feedback')).toBeTruthy())
  await fireEvent.press(within(screen.getByTestId('contribution-feedback')).getByRole('button', { name: 'Đóng' }))
  await headerBack()
  expect(screen.queryByTestId('contribution-exit')).toBeNull()
  expect(mockSave).toHaveBeenCalledTimes(1)
  await screen.unmount()
})

it('localises the exit options in English', async () => {
  await preview(); await dirty()
  await act(async () => { await i18n.changeLanguage('en') })
  await fireEvent.press(within(screen.getByTestId('import-header')).getByRole('button', { name: i18n.t('common.back') }))
  for (const label of ['Save draft', 'Don’t save', i18n.t('common.cancel')]) {
    expect(exit().getByRole('button', { name: label })).toBeTruthy()
  }
})
