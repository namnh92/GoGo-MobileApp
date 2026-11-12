import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { failed as mockFailed, loaded as mockLoaded, pausedOffline as mockPausedOffline, renderScreen } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import { useAppAreaStore } from '@/shared/location/app-area'
import { readPickerScope, savePickerScope, type PickerScope } from '@/shared/location/picker-scope'
import * as pickerScopes from '@/shared/location/picker-scope'
import type { ChipProps } from '@/shared/ui/chip.view'
import CreatePlacesScreen from '../create-places.view'
import { DateTimeSheet } from '../date-time-sheet.view'
import SearchScreen from '@/features/search/search.view'

const mockPush = jest.fn()
const mockFocus = jest.fn()
let mockScopeSequence = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockScopeSequence).padStart(12, '0')}` }))
let mockAddPress: () => void
jest.mock('@/shared/ui/primitives', () => {
  const actual = jest.requireActual('@/shared/ui/primitives')
  return { ...actual, Chip: (props: ChipProps) => {
    mockAddPress = props.onPress!
    return jest.requireActual('react').createElement(actual.Chip, props)
  } }
})
let mockParams: Record<string, string> = {}
let mockResults: Record<string, unknown>[] = []
let mockSparseDetail = mockLoaded(undefined)
const mockPreviews: { query: Record<string, unknown>; enabled: boolean }[] = []
const mockQueries: { query: Record<string, unknown>; enabled?: boolean }[] = []
const mockArea = { datasetVersion: 'ds-wizard', provinceCode: '79', provinceName: 'Hồ Chí Minh', communeCode: '26734', communeName: 'Bến Thành' }
const mockGlobal = { datasetVersion: 'ds-global', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null }
const mockSearch: Record<string, unknown> = { ...mockLoaded({ pages: [{ results: [], nextCursor: null }] }), isSuccess: true, isFetchedAfterMount: true, isFetching: false }
jest.mock('@/shared/ui/map-canvas.view', () => ({
  MapCanvas: (props: Record<string, unknown>) => {
    const React = jest.requireActual('react')
    const { View } = jest.requireActual('react-native')
    return React.createElement(View, { ...props, testID: 'round-four-map' })
  },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), useLocalSearchParams: () => mockParams, useFocusEffect: (effect: () => void) => mockFocus(effect) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({}),
  useTaxonomies: () => mockLoaded({ kinds: Object.fromEntries(['mood', 'setting', 'spending_style'].map(kind => [kind, 'abcdefg'.split('').map(key => ({ key, labels: { vi: `${kind} ${key}`, en: `${kind} ${key}` } }))])) }),
  useCreateRoom: () => ({ isPending: false }),
  usePlaceDetail: (id: string) => id === 'full' ? mockLoaded({ id, name: 'Verified cafe', rating: 4.5, ratingCount: 24, addressText: '12 Lê Lợi' }) : mockSparseDetail,
  usePlaceSearch: (query: Record<string, unknown>, options?: { enabled?: boolean }) => { mockQueries.push({ query, enabled: options?.enabled }); return mockSearch },
  useDiscoveryPreview: (query: Record<string, unknown>, enabled: boolean) => { mockPreviews.push({ query, enabled }); return mockLoaded(undefined) }, useContributionCredits: () => mockLoaded(undefined), useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }), useAddRoomSeedPlaces: () => ({ mutate: jest.fn() }),
}))

beforeEach(async () => {
  // VirtualizedList batches cell updates on timers; keep them inside test act boundaries.
  jest.useFakeTimers()
  mockFocus.mockClear()
  mockPush.mockClear(); mockQueries.length = 0; mockPreviews.length = 0; mockResults = []; mockSearch.data = { pages: [{ results: mockResults, nextCursor: null }] }; mockParams = {}
  mockSparseDetail = mockLoaded(undefined)
  useRoomStore.getState().resetDraft()
  useAppAreaStore.setState({ area: mockGlobal, scope: { status: 'ready', source: 'selected_area', area: mockGlobal } })
  await act(async () => { await i18n.changeLanguage('vi') })
})

afterEach(() => jest.useRealTimers())

it.each(['area', 'gps'] as const)('F-10: synchronous Add presses open one %s picker until Places regains focus', async source => {
  useRoomStore.getState().patchDraft(source === 'area'
    ? { administrativeArea: mockArea }
    : { originLat: 10.77123, originLng: 106.71234, radiusM: 5000 })
  const saveScope = jest.spyOn(pickerScopes, 'savePickerScope')
  try {
    const view = await renderScreen(<CreatePlacesScreen />)
    // Invoke the same rendered handler twice before React can render disabled state.
    const press = mockAddPress
    await act(async () => { press(); press() })
    expect({ saves: saveScope.mock.calls.length, pushes: mockPush.mock.calls.length }).toEqual({ saves: 1, pushes: 1 })
    const firstId = mockPush.mock.calls[0][0].params.pickerScope
    expect(readPickerScope(firstId)).not.toBeNull()
    expect(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeDisabled()

    // An unrelated draft render must not reopen the guard while the picker is away.
    await act(async () => useRoomStore.getState().patchDraft({ title: 'Changed title' }))
    await act(async () => { mockAddPress() })
    expect(saveScope).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)

    // Replay the registered focus callback as navigation does when the picker returns.
    await act(async () => { mockFocus.mock.calls.at(-1)![0]() })
    expect(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeEnabled()
    await fireEvent.press(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
    expect(saveScope).toHaveBeenCalledTimes(2)
    expect(mockPush).toHaveBeenCalledTimes(2)
    const nextId = mockPush.mock.calls[1][0].params.pickerScope
    expect(nextId).not.toBe(firstId)
    expect(readPickerScope(nextId)).not.toBeNull()
  } finally { saveScope.mockRestore() }
})

it.each(['area', 'gps'] as const)('round 4: opens picker with explicit wizard %s scope independent of global scope', async source => {
  useRoomStore.getState().patchDraft(source === 'area'
    ? { administrativeArea: mockArea, originLat: 10, originLng: 106, radiusM: 2000 }
    : { originLat: 10.77, originLng: 106.7, radiusM: 5000 })
  const wizard = await renderScreen(<CreatePlacesScreen />)
  await fireEvent.press(wizard.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  const href = mockPush.mock.calls[0][0]
  expect(href.pathname).toBe('/places/search')
  expect(href.params.picker).toBe('1')
  expect(href.params.pickerScope).toBeTruthy()
  mockParams = href.params
  await renderScreen(<SearchScreen />)
  const expected = source === 'area'
    ? { datasetVersion: 'ds-wizard', provinceCode: '79', communeCode: '26734' }
    : { lat: 10.77, lng: 106.7, radiusM: 5000 }
  for (const { query } of mockQueries.filter(call => call.enabled)) {
    expect(query).toMatchObject(expected)
    if (source === 'area') { expect(query.lat).toBeUndefined(); expect(query.lng).toBeUndefined() }
    else expect(query.provinceCode).toBeUndefined()
  }
  expect(mockQueries.some(call => call.enabled)).toBe(true)
  await act(async () => useAppAreaStore.setState({ area: null, scope: { status: 'ready', source: 'gps', position: { lat: 22, lng: 104 } } }))
  expect(mockQueries.at(-2)?.query).toMatchObject(expected)
})

it.each(['area', 'gps'] as const)('F-08: routes only an opaque id for the wizard %s scope', async source => {
  useRoomStore.getState().patchDraft(source === 'area'
    ? { administrativeArea: mockArea, originLat: 10.77123, originLng: 106.71234, radiusM: 2000 }
    : { originLat: 10.77123, originLng: 106.71234, radiusM: 5000 })
  const view = await renderScreen(<CreatePlacesScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/search', params: {
    picker: '1', pickerScope: expect.stringMatching(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i),
  } })
  expect(JSON.stringify(mockPush.mock.calls)).not.toMatch(/10\.77123|106\.71234|"lat"|"lng"|ds-wizard/)
})

it.each(['picker', 'wizard'] as const)('F-08: expires the snapshot when the %s closes; reopening a stale id fails closed', async closing => {
  useRoomStore.getState().patchDraft({ originLat: 10.77123, originLng: 106.71234, radiusM: 5000 })
  const wizard = await renderScreen(<CreatePlacesScreen />)
  await fireEvent.press(wizard.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  mockParams = mockPush.mock.calls[0][0].params
  expect(readPickerScope(mockParams.pickerScope)).toMatchObject({ source: 'gps', position: { lat: 10.77123, lng: 106.71234 }, radiusM: 5000 })
  if (closing === 'picker') {
    const picker = await renderScreen(<SearchScreen />)
    expect(mockQueries.some(call => call.enabled && call.query.lat === 10.77123 && call.query.radiusM === 5000)).toBe(true)
    await picker.unmount()
  } else await wizard.unmount()
  expect(readPickerScope(mockParams.pickerScope)).toBeNull()
  mockQueries.length = 0
  const expired = await renderScreen(<SearchScreen />)
  expect(mockQueries.filter(call => call.enabled)).toHaveLength(0)
  expect(expired.getByText(i18n.t('common.errorTitle'))).toBeTruthy()
  expect(expired.queryByTestId('search-results')).toBeNull()
  expect(expired.queryByRole('button', { name: i18n.t('common.retry') })).toBeNull()
})

it('F-08: an unknown scope id disables search and filter preview and shows an error', async () => {
  mockParams = { picker: '1', pickerScope: 'unknown-scope-id', filters: '1' }
  const view = await renderScreen(<SearchScreen />)
  await waitFor(() => expect(mockPreviews.length).toBeGreaterThan(1))
  expect(mockQueries.filter(call => call.enabled)).toHaveLength(0)
  expect(mockPreviews.filter(call => call.enabled)).toHaveLength(0)
  expect(view.getByText(i18n.t('common.errorTitle'))).toBeTruthy()
})

it('round 4: normal search ignores picker-only scope and wizard draft', async () => {
  useRoomStore.getState().patchDraft({ administrativeArea: mockArea, originLat: 10, originLng: 106, radiusM: 2000 })
  mockParams = { pickerScope: JSON.stringify({ status: 'ready', source: 'gps', position: { lat: 10, lng: 106 }, radiusM: 2000 }) }
  await renderScreen(<SearchScreen />)
  expect(mockQueries.find(call => call.enabled)?.query).toMatchObject({ datasetVersion: 'ds-global', provinceCode: '01' })
  expect(mockQueries.find(call => call.enabled)?.query.lat).toBeUndefined()
})

it('round 4: malformed explicit picker scope never falls back to global search', async () => {
  mockParams = { picker: '1', pickerScope: '{invalid' }
  await renderScreen(<SearchScreen />)
  expect(mockQueries.filter(call => call.enabled)).toHaveLength(0)
  expect(mockQueries.every(call => call.query.provinceCode === undefined)).toBe(true)
})

it.each([mockArea, { ...mockArea, communeCode: null, communeName: null }])('GPS anywhere: resolved administrative area becomes the opaque picker scope (%j)', async area => {
  useRoomStore.getState().patchDraft({ originLat: 10.77123, originLng: 106.71234, radiusM: null })
  useAppAreaStore.setState({ area, scope: { status: 'ready', source: 'gps', position: { lat: 10.77123, lng: 106.71234 } } })
  const wizard = await renderScreen(<CreatePlacesScreen />)
  const add = wizard.getByRole('button', { name: i18n.t('createPlaces.addPlace') })
  expect(add).toBeEnabled()
  await fireEvent.press(add)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/search', params: {
    picker: '1', pickerScope: expect.stringMatching(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i),
  } })
  mockParams = mockPush.mock.calls[0][0].params
  expect(readPickerScope(mockParams.pickerScope)).toEqual({ status: 'ready', source: 'selected_area', area })
  expect(JSON.stringify(mockParams)).not.toMatch(/10\.77123|106\.71234|"lat"|"lng"|ds-wizard/)
  await renderScreen(<SearchScreen />)
  const enabled = mockQueries.filter(call => call.enabled)
  expect(enabled.length).toBeGreaterThan(0)
  for (const { query } of enabled) {
    expect(query).toMatchObject({ datasetVersion: area.datasetVersion, provinceCode: area.provinceCode })
    expect(query.communeCode ?? null).toBe(area.communeCode)
    expect(query.lat).toBeUndefined(); expect(query.lng).toBeUndefined(); expect(query.radiusM).toBeUndefined()
  }
  // The picker freezes its area even if the app selection changes afterwards.
  await act(async () => useAppAreaStore.setState({ area: mockGlobal, scope: { status: 'ready', source: 'selected_area', area: mockGlobal } }))
  expect(readPickerScope(mockParams.pickerScope)).toEqual({ status: 'ready', source: 'selected_area', area })
})

it.each(['pending', 'failed', 'different-position', 'manual'] as const)('GPS anywhere: %s resolution keeps Add disabled with a reason', async resolution => {
  useRoomStore.getState().patchDraft({ originLat: 10, originLng: 106, radiusM: null })
  useAppAreaStore.setState(resolution === 'pending'
    ? { area: mockArea, scope: { status: 'resolving' } }
    : resolution === 'failed'
      ? { area: null, scope: { status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } } }
      : resolution === 'different-position'
        ? { area: mockArea, scope: { status: 'ready', source: 'gps', position: { lat: 11, lng: 106 } } }
        : { area: mockGlobal, scope: { status: 'ready', source: 'selected_area', area: mockGlobal } })
  const view = await renderScreen(<CreatePlacesScreen />)
  const add = view.getByRole('button', { name: i18n.t('createPlaces.addPlace') })
  expect(add).toBeDisabled()
  expect(view.getByText(i18n.t('createPlaces.seedScopeUnavailable'))).toBeTruthy()
  await fireEvent.press(add)
  expect(mockPush).not.toHaveBeenCalled()
})

it('GPS anywhere: pending resolution enables Add when the matching area arrives', async () => {
  useRoomStore.getState().patchDraft({ originLat: 10, originLng: 106, radiusM: null })
  useAppAreaStore.setState({ area: null, scope: { status: 'resolving' } })
  const view = await renderScreen(<CreatePlacesScreen />)
  expect(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeDisabled()
  await act(async () => useAppAreaStore.setState({ area: mockArea, scope: { status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } } }))
  const add = view.getByRole('button', { name: i18n.t('createPlaces.addPlace') })
  expect(add).toBeEnabled()
  expect(view.queryByText(i18n.t('createPlaces.seedScopeUnavailable'))).toBeNull()
  await fireEvent.press(add)
  expect(readPickerScope(mockPush.mock.calls[0][0].params.pickerScope)).toEqual({ status: 'ready', source: 'selected_area', area: mockArea })
})

it('GPS finite radius: resolved administrative area does not replace coordinates and radius', async () => {
  useRoomStore.getState().patchDraft({ originLat: 10, originLng: 106, radiusM: 5000 })
  useAppAreaStore.setState({ area: mockArea, scope: { status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } } })
  const view = await renderScreen(<CreatePlacesScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  expect(readPickerScope(mockPush.mock.calls[0][0].params.pickerScope)).toEqual({ status: 'ready', source: 'gps', position: { lat: 10, lng: 106 }, radiusM: 5000 })
})

it('round 6t: seed remove overlaps each full-width small card and only removes that seed', async () => {
  useRoomStore.getState().addSeedPlace({ placeId: 'full', name: 'Verified cafe' })
  useRoomStore.getState().addSeedPlace({ placeId: 'sparse', name: 'Sparse cafe' })
  const view = await renderScreen(<CreatePlacesScreen />)
  const cards = view.getAllByTestId('place-card-small')
  expect(cards).toHaveLength(2)
  const listStyle = StyleSheet.flatten(view.getByTestId('create-places-seed-list').props.style)
  expect(listStyle.flexDirection).toBe('column')
  expect(listStyle.paddingTop).toBe(12)
  expect(listStyle.paddingBottom ?? 0).toBe(0)
  expect(listStyle.overflow).toBe('visible')
  expect(listStyle.gap).toBeGreaterThanOrEqual(24)
  const listPadding = StyleSheet.flatten(view.getByTestId('create-places-list').props.contentContainerStyle)
  expect(listPadding.paddingHorizontal).toBeGreaterThanOrEqual(12)
  expect(within(cards[0]).getByTestId('place-google-rating')).toBeTruthy()
  expect(within(cards[1]).queryByTestId('place-google-rating')).toBeNull()
  expect(within(cards[1]).queryByTestId('place-gogo-rating')).toBeNull()
  expect(within(cards[1]).queryByTestId('place-card-ratings')).toBeNull()
  expect(within(cards[1]).queryByText('—')).toBeNull()
  expect(within(cards[1]).queryByTestId('place-card-address')).toBeNull()
  for (const [index, name] of ['Verified cafe', 'Sparse cafe'].entries()) {
    const remove = view.getByRole('button', { name: i18n.t('createPlaces.removePlace', { name }) })
    const surface = view.getAllByTestId('place-card-surface')[index]
    expect(within(surface).getByRole('button', { name: i18n.t('createPlaces.removePlace', { name }) })).toBe(remove)
    expect(surface.parent?.props.testID).toBe('create-places-seed-list')
    expect(StyleSheet.flatten(surface.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(surface.props.style).overflow).toBe('visible')
    expect(within(remove).queryByText(name)).toBeNull()
    const style = StyleSheet.flatten(remove.props.style)
    expect(style.position).toBe('absolute')
    expect(style.top).toBe(-style.height / 2); expect(style.right).toBe(-style.width / 2)
    expect(style.width + remove.props.hitSlop.left + remove.props.hitSlop.right).toBeGreaterThanOrEqual(44)
    expect(style.height + remove.props.hitSlop.top + remove.props.hitSlop.bottom).toBeGreaterThanOrEqual(44)
  }
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createPlaces.removePlace', { name: 'Verified cafe' }) }))
  expect(view.getAllByTestId('place-card-small')).toHaveLength(1)
  expect(useRoomStore.getState().seedPlaces).toEqual([{ placeId: 'sparse', name: 'Sparse cafe' }])
  expect(mockPush).not.toHaveBeenCalled()
  expect(view.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeTruthy()
})

it.each(['offline', 'failed'] as const)('F-09: seed without cached detail keeps only known facts when %s', async state => {
  mockSparseDetail = state === 'offline' ? mockPausedOffline() : mockFailed()
  useRoomStore.getState().addSeedPlace({ placeId: 'sparse', name: 'Sparse cafe' })
  const view = await renderScreen(<CreatePlacesScreen />)
  const card = within(view.getByTestId('place-card-small'))
  expect(card.getByText('Sparse cafe')).toBeTruthy()
  for (const id of ['place-google-rating', 'place-gogo-rating', 'place-card-ratings']) expect(card.queryByTestId(id)).toBeNull()
})


it.each(['area', 'gps'] as const)('round 4: filter previews and map panning retain the explicit %s scope', async source => {
  const scope: PickerScope = source === 'area' ? { status: 'ready', source: 'selected_area', area: mockArea }
    : { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 }, radiusM: 2000 }
  mockParams = { picker: '1', pickerScope: savePickerScope(scope) }
  mockResults = [{ id: 'place-1', name: 'Cafe', lat: 10.77, lng: 106.7, isLodging: false }]
  mockSearch.data = { pages: [{ results: mockResults, nextCursor: null }] }
  const expected = source === 'area' ? { datasetVersion: 'ds-wizard', provinceCode: '79', communeCode: '26734' }
    : { lat: 10.77, lng: 106.7, radiusM: 2000 }
  let view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('search.filters') }))
  await waitFor(() => expect(mockPreviews.some(call => call.enabled)).toBe(true))
  expect(mockPreviews.find(call => call.enabled)?.query).toMatchObject(expected)
  await view.unmount()
  mockParams = { picker: '1', pickerScope: savePickerScope(scope) }
  view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByRole('tab', { name: i18n.t('discovery.map') }))
  const map = view.getByTestId('round-four-map')
  await act(async () => {
    map.props.onRegionChangeComplete({ latitude: 22, longitude: 104, latitudeDelta: 0.1, longitudeDelta: 0.1 })
    await jest.advanceTimersByTimeAsync(450)
  })
  for (const { query } of mockQueries.filter(call => call.enabled)) expect(query).toMatchObject(expected)
})

it.each(['vi', 'en'])('retains the calendar-only expander regression after retiring Mood (%s)', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  const view = await renderScreen(<DateTimeSheet initialDay={null} onDayChange={jest.fn()} />)
  const calendar = view.getByRole('button', { name: i18n.t('createTime.expandCalendar') })
  expect(calendar.parent!.children.at(-1)).toBe(calendar)
  expect(within(calendar).queryByText(i18n.t('createTime.expandCalendar'))).toBeNull()
  expect(within(calendar).getByTestId('material-icon-keyboardDoubleArrowDown', { includeHiddenElements: true })).toBeTruthy()
  expect(StyleSheet.flatten(calendar.props.style).minHeight).toBeGreaterThanOrEqual(44)
  await fireEvent.press(calendar)
  expect(within(view.getByRole('button', { name: i18n.t('createTime.collapseCalendar') })).getByTestId('material-icon-keyboardDoubleArrowUp', { includeHiddenElements: true })).toBeTruthy()
})

it.each([
  ['couple', 'per_person', 600001, 6, 300000],
  ['group-host', 'total', 800003, 4, 200000],
  ['group-host', 'per_person', 200001, 6, 200001],
  ['group-host', 'total', null, 4, undefined],
] as const)('round 6v: full picker receives price ceiling for %s / %s', async (audience, budgetMode, budgetAmount, participantCount, ceiling) => {
  useRoomStore.setState({ audience, budgetMode, budgetAmount, participantCount, administrativeArea: mockArea })
  const wizard = await renderScreen(<CreatePlacesScreen />)
  expect(mockQueries).toHaveLength(0)
  await fireEvent.press(wizard.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  mockParams = mockPush.mock.calls[0][0].params
  const search = await renderScreen(<SearchScreen />)
  expect(mockQueries.filter(call => call.enabled && call.query.limit === 10).length).toBeGreaterThan(0)
  for (const { query } of mockQueries.filter(call => call.enabled && call.query.limit === 10)) {
    expect(query.priceMaxPerPerson).toBe(ceiling)
    expect(query).toMatchObject({ datasetVersion: mockArea.datasetVersion, provinceCode: mockArea.provinceCode, communeCode: mockArea.communeCode })
  }
  await search.unmount()
  mockParams = {}
  mockQueries.length = 0
  await renderScreen(<SearchScreen />)
  expect(mockQueries.filter(call => call.enabled && call.query.limit === 10).every(call => call.query.priceMaxPerPerson === undefined)).toBe(true)
})
