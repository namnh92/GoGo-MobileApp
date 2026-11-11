import { act, fireEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { renderScreen } from '../../__tests__/harness'
import { useAppAreaStore as mockAreaStore } from '@/shared/location/app-area'
import { useRoomStore, toCreateRoomBody } from '@/shared/store/roomStore'
import i18n from '@/shared/i18n'
import CreateType from '../create-type.view'
import GroupSetup from '../group-setup.view'
import LegacyLocation from '@/app/create/location'
import { saveRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { DraftPlanCard } from '../draft-plan-card.view'
import { WizardStep } from '../wizard-step.view'

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockRefresh = jest.fn(async () => {})
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(callback, [callback])
  },
  Redirect: ({ href }: { href: string }) => {
    const React = jest.requireActual<typeof import('react')>('react')
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
    return React.createElement(Text, { testID: 'redirect' }, href)
  },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: { homeAdministrativeArea: null } }),
}))
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: mockAreaStore(state => state.location), refresh: mockRefresh }),
}))
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => ({ data: { datasetVersion: 'current' } }),
  useAdministrativeUnits: () => ({ data: [], isPending: false }),
}))
const AREA = { datasetVersion: 'old', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null }
beforeEach(() => {
  mockPush.mockClear()
  mockRefresh.mockClear()
  useRoomStore.getState().resetDraft()
  mockAreaStore.setState({ area: null, manual: false, scope: { status: 'resolving' }, location: { status: 'idle' } })
})
it('round 3: renders the full-width area field below the name in step 1 and opens the existing sheet', async () => {
  const view = await renderScreen(<CreateType />)
  const scroll = within(view.getByTestId('create-type-scroll'))
  expect(scroll.getByText('Khu vực')).toBeTruthy()
  const field = scroll.getByTestId('create-location-field')
  expect(field.props.accessibilityRole).toBe('button')
  expect(StyleSheet.flatten(field.props.style).minHeight).toBeGreaterThanOrEqual(44)
  expect(mockRefresh).toHaveBeenCalledTimes(1)
  await fireEvent.press(field)
  expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
})
it.each(['couple', 'group-host'] as const)('round 3: validates the dataset on step 1 before continuing for %s', async audience => {
  useRoomStore.getState().setAudience(audience)
  useRoomStore.getState().patchDraft({ administrativeArea: AREA })
  // An app-start GPS fix must not erase a manual choice restored from a draft.
  mockAreaStore.setState({ location: { status: 'granted', lat: 21, lng: 105, label: 'GPS' },
    scope: { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } } })
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(mockPush).not.toHaveBeenCalled()
  expect(view.getByText(i18n.t('administrative.changed'))).toBeTruthy()
  expect(useRoomStore.getState().administrativeArea).toEqual(AREA)
})
it('round 3: step 1 owns current-position radius chips, persists the choice and keeps the payload', async () => {
  mockAreaStore.setState({ location: { status: 'granted', lat: 21, lng: 105, label: 'Hà Nội' },
    scope: { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } } })
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByRole('button', { name: '10 km' }))
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(mockPush).toHaveBeenCalledWith('/create/time')
  expect(toCreateRoomBody(useRoomStore.getState()).constraint).toMatchObject({ originLat: 21, originLng: 105, radiusM: 10000 })
  await view.unmount()
  const resumed = await renderScreen(<CreateType />)
  expect(resumed.getByRole('button', { name: '10 km' }).props.accessibilityState.selected).toBe(true)
})
it.each([['couple', 4], ['group-host', 5]] as const)('round 3: counts all steps for %s without a location page', async (audience, total) => {
  useRoomStore.getState().setAudience(audience)
  const keys = audience === 'couple' ? ['type', 'time', 'budget', 'mood'] as const : ['type', 'group-setup', 'time', 'budget', 'mood'] as const
  const view = await renderScreen(<WizardStep step="type" onBack={mockBack} />)
  for (const [index, step] of keys.entries()) {
    await view.rerender(<WizardStep step={step} onBack={mockBack} />)
    expect(view.getByText(`Bước ${index + 1} / ${total}`)).toBeTruthy()
  }
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(mockBack).toHaveBeenCalled()
})
it('round 3: group goes from type to group setup to time', async () => {
  const view = await renderScreen(<CreateType />)
  await fireEvent.press(view.getByText('Nhóm bạn'))
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(mockPush).toHaveBeenLastCalledWith('/create/group-setup')
  await view.unmount()
  const group = await renderScreen(<GroupSetup />)
  await fireEvent.press(group.getByText('Tiếp tục'))
  expect(mockPush).toHaveBeenLastCalledWith('/create/time')
})
it('round 3: old /create/location deep links redirect to step 1', async () => {
  const view = await renderScreen(<LegacyLocation />)
  expect(view.getByTestId('redirect').props.children).toBe('/create/type')
})

it.each(['couple', 'group-host'] as const)('round 3: draft PlanCard pushes only step 1 for a saved old location route (%s)', async audience => {
  useRoomStore.getState().setAudience(audience)
  await act(async () => {
    await saveRoomDraft('owner', 'type')
    const snapshot = useSavedRoomDraft.getState().draft!
    useSavedRoomDraft.setState({ draft: { ...snapshot, step: 'location' } })
  })
  const view = await renderScreen(<DraftPlanCard draft={useSavedRoomDraft.getState().draft!} />)
  await fireEvent.press(view.getByTestId('plan-card-draft'))
  expect(mockPush.mock.calls).toEqual([['/create/type']])
})
it('round 3: restores an unlimited GPS radius without resetting it to the default', async () => {
  useRoomStore.getState().patchDraft({ originLat: 21, originLng: 105, radiusM: null })
  mockAreaStore.setState({ location: { status: 'granted', lat: 21, lng: 105, label: 'GPS' },
    scope: { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } } })
  const view = await renderScreen(<CreateType />)
  expect(view.getByRole('button', { name: i18n.t('createLocation.anywhere') }).props.accessibilityState.selected).toBe(true)
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(toCreateRoomBody(useRoomStore.getState()).constraint).not.toHaveProperty('radiusM')
})
