import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { loaded as mockLoaded, renderScreen } from '../../__tests__/harness'
import i18n from '@/shared/i18n'
import { useRoomStore } from '@/shared/store/roomStore'
import { useAppAreaStore } from '@/shared/location/app-area'
import CreateMoodScreen from '../create-mood.view'
import { DateTimeSheet } from '../date-time-sheet.view'
import SearchScreen from '@/features/search/search.view'

const mockPush = jest.fn()
let mockParams: Record<string, string> = {}
let mockResults: Record<string, unknown>[] = []
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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), useLocalSearchParams: () => mockParams, useFocusEffect: () => {} }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { userId: 'owner' } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({}),
  useTaxonomies: () => mockLoaded({ kinds: Object.fromEntries(['mood', 'setting', 'spending_style'].map(kind => [kind, 'abcdefg'.split('').map(key => ({ key, labels: { vi: `${kind} ${key}`, en: `${kind} ${key}` } }))])) }),
  useCreateRoom: () => ({ isPending: false }),
  usePlaceDetail: (id: string) => mockLoaded(id === 'full' ? { id, name: 'Verified cafe', rating: 4.5, ratingCount: 24, addressText: '12 Lê Lợi' } : undefined),
  usePlaceSearch: (query: Record<string, unknown>, options?: { enabled?: boolean }) => { mockQueries.push({ query, enabled: options?.enabled }); return mockSearch },
  useDiscoveryPreview: (query: Record<string, unknown>, enabled: boolean) => { mockPreviews.push({ query, enabled }); return mockLoaded(undefined) }, useContributionCredits: () => mockLoaded(undefined), useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }), useAddRoomSeedPlaces: () => ({ mutate: jest.fn() }),
}))

beforeEach(async () => {
  mockPush.mockClear(); mockQueries.length = 0; mockPreviews.length = 0; mockResults = []; mockSearch.data = { pages: [{ results: mockResults, nextCursor: null }] }; mockParams = {}
  useRoomStore.getState().resetDraft()
  useAppAreaStore.setState({ area: mockGlobal, scope: { status: 'ready', source: 'selected_area', area: mockGlobal } })
  await act(async () => { await i18n.changeLanguage('vi') })
})

it.each(['vi', 'en'])('round 4: shared icon-only accessible mood/calendar toggles (%s)', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  let view = await renderScreen(<CreateMoodScreen />)
  const toggles = view.getAllByRole('button', { name: i18n.t('createMood.showAll') })
  expect(toggles).toHaveLength(3)
  for (const toggle of toggles) {
    expect(within(toggle).queryByText(i18n.t('createMood.showAll'))).toBeNull()
    expect(within(toggle).getByTestId('material-icon-keyboardDoubleArrowDown', { includeHiddenElements: true })).toBeTruthy()
    const style = StyleSheet.flatten(toggle.props.style)
    expect(style.minHeight).toBeGreaterThanOrEqual(44); expect(style.minWidth).toBeGreaterThanOrEqual(44)
    expect(toggle.props.accessibilityState.expanded).toBe(false)
    expect(StyleSheet.flatten(toggle.parent?.props.style).alignItems).toBe('center')
    const title = toggle.parent?.children[0]
    expect(StyleSheet.flatten(typeof title === 'object' ? title.props.style : undefined).flex).toBe(1)
  }
  await fireEvent.press(toggles[0])
  const collapse = view.getByRole('button', { name: i18n.t('createMood.showLess') })
  expect(collapse.props.accessibilityState.expanded).toBe(true)
  expect(within(collapse).getByTestId('material-icon-keyboardDoubleArrowUp', { includeHiddenElements: true })).toBeTruthy()
  expect(view.getAllByRole('checkbox')).toHaveLength(17)
  await fireEvent.press(collapse)
  expect(view.getAllByRole('checkbox')).toHaveLength(15)
  await view.unmount()
  view = await renderScreen(<DateTimeSheet initialDay={null} onDayChange={jest.fn()} />)
  const calendar = view.getByRole('button', { name: i18n.t('createTime.expandCalendar') })
  expect(within(calendar).queryByText(i18n.t('createTime.expandCalendar'))).toBeNull()
  expect(within(calendar).getByTestId('material-icon-keyboardDoubleArrowDown', { includeHiddenElements: true })).toBeTruthy()
  expect(StyleSheet.flatten(calendar.props.style).minHeight).toBeGreaterThanOrEqual(44)
  await fireEvent.press(calendar)
  expect(within(view.getByRole('button', { name: i18n.t('createTime.collapseCalendar') })).getByTestId('material-icon-keyboardDoubleArrowUp', { includeHiddenElements: true })).toBeTruthy()
})

it.each(['area', 'gps'] as const)('round 4: opens picker with explicit wizard %s scope independent of global scope', async source => {
  useRoomStore.getState().patchDraft(source === 'area'
    ? { administrativeArea: mockArea, originLat: 10, originLng: 106, radiusM: 2000 }
    : { originLat: 10.77, originLng: 106.7, radiusM: 5000 })
  let view = await renderScreen(<CreateMoodScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createMood.addPlace') }))
  const href = mockPush.mock.calls[0][0]
  expect(href.pathname).toBe('/places/search')
  expect(href.params.picker).toBe('1')
  expect(href.params.pickerScope).toBeTruthy()
  mockParams = href.params
  await view.unmount()
  view = await renderScreen(<SearchScreen />)
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

it('round 4: unlimited GPS picker is blocked by the actual search contract', async () => {
  useRoomStore.getState().patchDraft({ originLat: 10, originLng: 106, radiusM: null })
  const view = await renderScreen(<CreateMoodScreen />)
  const add = view.getByRole('button', { name: i18n.t('createMood.addPlace') })
  expect(add.props.accessibilityState.disabled).toBe(true)
  expect(view.getByText(i18n.t('createMood.seedRadiusUnsupported'))).toBeTruthy()
  await fireEvent.press(add)
  expect(mockPush).not.toHaveBeenCalled()
})

it('round 4: seed places use vertical shared small cards with accessible remove and omitted unknown facts', async () => {
  useRoomStore.getState().addSeedPlace({ placeId: 'full', name: 'Verified cafe' })
  useRoomStore.getState().addSeedPlace({ placeId: 'sparse', name: 'Sparse cafe' })
  const view = await renderScreen(<CreateMoodScreen />)
  const cards = view.getAllByTestId('place-card-small')
  expect(cards).toHaveLength(2)
  expect(view.getByTestId('create-mood-seed-list').props.style.flexDirection).toBe('column')
  expect(within(cards[0]).getByTestId('place-google-rating')).toBeTruthy()
  expect(within(cards[1]).queryByTestId('place-google-rating')).toBeNull()
  expect(within(cards[1]).queryByText('—')).toBeNull()
  expect(within(cards[1]).queryByTestId('place-card-address')).toBeNull()
  for (const name of ['Verified cafe', 'Sparse cafe']) {
    const remove = view.getByRole('button', { name: i18n.t('createMood.removePlace', { name }) })
    expect(within(remove).queryByText(name)).toBeNull()
    const style = StyleSheet.flatten(remove.props.style)
    expect(style.width ?? style.minWidth).toBeGreaterThanOrEqual(44)
    expect(style.height ?? style.minHeight).toBeGreaterThanOrEqual(44)
  }
  await fireEvent.press(view.getByRole('button', { name: i18n.t('createMood.removePlace', { name: 'Verified cafe' }) }))
  expect(view.getAllByTestId('place-card-small')).toHaveLength(1)
  expect(useRoomStore.getState().seedPlaces).toEqual([{ placeId: 'sparse', name: 'Sparse cafe' }])
  expect(view.getByRole('button', { name: i18n.t('createMood.addPlace') })).toBeTruthy()
})


it.each(['area', 'gps'] as const)('round 4: filter previews and map panning retain the explicit %s scope', async source => {
  const scope = source === 'area' ? { status: 'ready', source: 'selected_area', area: mockArea }
    : { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 }, radiusM: 2000 }
  mockParams = { picker: '1', pickerScope: JSON.stringify(scope) }
  mockResults = [{ id: 'place-1', name: 'Cafe', lat: 10.77, lng: 106.7, isLodging: false }]
  mockSearch.data = { pages: [{ results: mockResults, nextCursor: null }] }
  const expected = source === 'area' ? { datasetVersion: 'ds-wizard', provinceCode: '79', communeCode: '26734' }
    : { lat: 10.77, lng: 106.7, radiusM: 2000 }
  let view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByRole('button', { name: i18n.t('search.filters') }))
  await waitFor(() => expect(mockPreviews.some(call => call.enabled)).toBe(true))
  expect(mockPreviews.find(call => call.enabled)?.query).toMatchObject(expected)
  await view.unmount()
  view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByRole('tab', { name: i18n.t('discovery.map') }))
  const map = view.getByTestId('round-four-map')
  await act(async () => {
    map.props.onRegionChangeComplete({ latitude: 22, longitude: 104, latitudeDelta: 0.1, longitudeDelta: 0.1 })
    await new Promise(resolve => setTimeout(resolve, 450))
  })
  for (const { query } of mockQueries.filter(call => call.enabled)) expect(query).toMatchObject(expected)
})
