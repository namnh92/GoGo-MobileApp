import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { render } from '@/shared/ui/__tests__/query-render'
import { useRoomStore, MAX_SEED_PLACES } from '@/shared/store/roomStore'
import { useSavedRoomDraft, clearSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useAppAreaStore } from '@/shared/location/app-area'
import { track } from '@/shared/analytics'
import { ApiError } from '@/shared/api/errors'
import { readPickerPriceMax, readPickerScope } from '@/shared/location/picker-scope'
import { redirectSystemPath } from '@/app/+native-intent'
import i18n from '@/shared/i18n'
import CreatePlaces from '../create-places.view'

let mockUuid = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }))
const mockSearch = jest.fn()
const mockDetail = jest.fn()
const mockCreate = jest.fn()
const mockPrepareInvite = jest.fn()
jest.mock('@/features/gogo-room/prepare-room-invite', () => ({ prepareRoomInvite: (...args: unknown[]) => mockPrepareInvite(...args) }))
const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockNoteCreated = jest.fn()
let mockStatus = 'user'
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined, useRouter: () => ({ replace: mockReplace, push: mockPush }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus, session: { kind: 'user', userId: 'owner' } }) }))
jest.mock('@/shared/api/endpoints/places', () => ({
  ...jest.requireActual('@/shared/api/endpoints/places'),
  searchPlaces: (...args: unknown[]) => mockSearch(...args),
  getPlaceDetail: (id: string) => mockDetail(id),
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  createAndOpenRoom: (...args: unknown[]) => mockCreate(...args),
}))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('@/shared/store/assistantIntroStore', () => ({ noteAssistantPlanCreated: (...args: unknown[]) => mockNoteCreated(...args) }))
const area = { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: '26734', provinceName: 'Hồ Chí Minh', communeName: 'Bến Thành' }
const created = { id: 'new-room', type: 'couple', decisionMode: 'match', status: 'collecting' }
let client: QueryClient
beforeEach(async () => {
  // Own FlatList's delayed cell-batching work, which can fire between act calls under load.
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockPrepareInvite.mockResolvedValue(undefined)
  onlineManager.setOnline(true)
  mockStatus = 'user'
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  useRoomStore.getState().resetDraft()
  // Places is reached after the required time step has been completed.
  useRoomStore.setState({ scheduleDay: '2031-01-14', startTime: '19:00', startAt: new Date(2031, 0, 14, 19).toISOString() })
  useRoomStore.getState().patchDraft({ administrativeArea: area, budgetAmount: 600001 })
  useAppAreaStore.setState({ area: null, scope: { status: 'resolving' } })
  useSavedRoomDraft.setState({ draft: null })
  useRecentRoomsStore.setState({ rooms: [] })
  await clearSavedRoomDraft()
  await i18n.changeLanguage('vi')
  mockDetail.mockImplementation((id: string) => Promise.resolve({ id, name: `Place ${id}` }))
  mockSearch.mockResolvedValue({ results: [], nextCursor: null })
  mockCreate.mockResolvedValue(created)
})
afterEach(async () => {
  try {
    await act(async () => { jest.runOnlyPendingTimers() })
  } finally {
    onlineManager.setOnline(true)
    client.clear()
    jest.useRealTimers()
  }
})
const open = () => render(<CreatePlaces />, client)
const create = () => fireEvent.press(screen.getByRole('button', { name: i18n.t('createPlaces.cta') }))

it.each(['vi', 'en'])('F-22 keeps wizard step 4 seed rating facts in %s', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    mockDetail.mockResolvedValue({ id: 'seed', name: 'Seed café', rating: 4.5, ratingCount: 1395, gogoRatingCount: 0 })
    useRoomStore.getState().addSeedPlace({ placeId: 'seed', name: 'Seed café' })
    await open()
    await screen.findByTestId('place-gogo-rating')
    const card = within(screen.getByTestId('create-places-seed-list'))
    expect(card.getByTestId('place-gogo-rating')).toHaveTextContent(language === 'vi' ? 'GoGo · 0 đánh giá' : 'GoGo · 0 reviews')
    expect(card.getByTestId('place-google-rating')).toHaveTextContent(language === 'vi' ? '★ 4,5 (1.395) Google' : '★ 4.5 (1,395) Google')
    for (const id of ['place-gogo-rating-count', 'place-gogo-rating-source', 'place-google-rating-count', 'place-google-rating-source']) {
      const fact = card.getByTestId(id)
      expect(fact.props.numberOfLines).toBeUndefined()
      expect(fact.props.ellipsizeMode).toBeUndefined()
      expect(StyleSheet.flatten(fact.props.style).flexShrink).toBe(0)
    }
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})

it.each([
  ['couple', 'per_person', 600001, 4, 300000, 'couple'],
  ['group-host', 'total', 800003, 4, 200000, 'group'],
  ['group-host', 'per_person', 200001, 6, 200001, 'group'],
  ['group-host', 'total', null, 4, undefined, 'group'],
  ['couple', 'total', 0, 4, undefined, 'couple'],
] as const)('sends canonical area and derived price: %s / %s / %s', async (audience, budgetMode, budgetAmount, participantCount, price, _suitedFor) => {
  useRoomStore.setState({ audience, budgetMode, budgetAmount, participantCount })
  await open()
  expect(mockSearch).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  const id = mockPush.mock.calls[0][0].params.pickerScope
  expect(readPickerScope(id)).toEqual({ status: 'ready', source: 'selected_area', area })
  expect(readPickerPriceMax(id)).toBe(price)
})
it('uses the exact GPS radius in both search and the opaque + picker scope', async () => {
  useRoomStore.setState({ administrativeArea: null, originLat: 10.77, originLng: 106.7, radiusM: 5000 })
  await open()
  expect(mockSearch).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  const href = mockPush.mock.calls[0][0]
  expect(href.pathname).toBe('/places/search')
  expect(readPickerPriceMax(href.params.pickerScope)).toBe(300000)
  expect(readPickerScope(href.params.pickerScope)).toMatchObject({ source: 'gps', position: { lat: 10.77, lng: 106.7 }, radiusM: 5000 })
})
it('fails closed without a valid draft area but keeps optional create available', async () => {
  useRoomStore.setState({ administrativeArea: null })
  await open()
  expect(mockSearch).not.toHaveBeenCalled()
  expect(screen.getByText(i18n.t('createPlaces.seedScopeUnavailable'))).toBeTruthy()
  expect(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeDisabled()
  expect(screen.getByRole('button', { name: i18n.t('createPlaces.cta') })).toBeEnabled()
})
it.each(['vi', 'en'])('uses optional time-neutral step copy in %s', async locale => {
  await i18n.changeLanguage(locale)
  await open()
  expect(screen.getByText(i18n.t('createPlaces.title'))).toBeTruthy()
  expect(screen.getByText(i18n.t('createPlaces.body'))).toBeTruthy()
  expect(screen.queryByRole('checkbox')).toBeNull()
})
it('creates with zero seeds, remembers the room, clears draft, and only emits room-created analytics', async () => {
  await open(); await create()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/room/new-room'))
  expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('seedPlaceIds')
  expect(useRoomStore.getState()).toMatchObject({ title: '', budgetAmount: null, seedPlaces: [], creationPending: false })
  expect(useSavedRoomDraft.getState().draft).toBeNull()
  expect(useRecentRoomsStore.getState().rooms[0].roomId).toBe(created.id)
  expect(mockNoteCreated).toHaveBeenCalledWith('owner')
  expect(track).toHaveBeenCalledWith('gogo_room_created', { roomType: 'couple', decisionMode: 'match' })
  expect(track).not.toHaveBeenCalledWith('date_context_completed', expect.anything())
})
it('keeps successful creation and navigation when background invite preparation fails', async () => {
  mockPrepareInvite.mockRejectedValueOnce(new Error('invite offline'))
  await open(); await create()
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/room/new-room'))
  expect(mockCreate).toHaveBeenCalledTimes(1)
  expect(mockPrepareInvite).toHaveBeenCalledWith(client, created.id)
  expect(screen.queryByTestId('create-places-create-error')).toBeNull()
  expect(useRoomStore.getState().creationPending).toBe(false)
})
it('persists retry identity at places before sending, reuses it after timeout, rotates on a changed request', async () => {
  mockCreate.mockImplementationOnce(() => {
    expect(useSavedRoomDraft.getState().draft?.step).toBe('places')
    return Promise.reject(new Error('timeout'))
  }).mockRejectedValueOnce(new Error('timeout'))
  await open(); await create()
  expect(await screen.findByText(i18n.t('createPlaces.createFailed'))).toBeTruthy()
  const identity = useRoomStore.getState().creationAttempt
  expect(identity?.key).toBeTruthy()
  await create()
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2))
  expect(mockCreate.mock.calls[1][1]).toBe(mockCreate.mock.calls[0][1])
  expect(useRoomStore.getState().creationAttempt).toEqual(identity)
  await act(async () => useRoomStore.getState().patchDraft({ title: 'Changed request' }))
  await create()
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(3))
  expect(mockCreate.mock.calls[2][1]).not.toBe(identity?.key)
})
it.each([
  [new ApiError(409, { code: 'ADMINISTRATIVE_VERSION_CHANGED', message: 'old' }), 'administrative.changed'],
  [new ApiError(422, { code: 'VALIDATION_ERROR', message: 'invalid', field_errors: [{ field: 'constraint.startAt', code: 'INVALID_TIME', message: 'Pick another time' }] }), 'Pick another time'],
  [new Error('network'), 'createPlaces.createFailed'],
] as const)('preserves create error copy %#', async (error, key) => {
  mockCreate.mockRejectedValueOnce(error)
  await open(); await create()
  expect(await screen.findByText(key === 'Pick another time' ? key : i18n.t(key))).toBeTruthy()
  expect(useRoomStore.getState().creationPending).toBe(false)
  expect(mockPrepareInvite).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})
it('keeps one create in flight and the blocking overlay until completion', async () => {
  let finish!: (value: typeof created) => void
  mockCreate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open(); await create()
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  expect(useRoomStore.getState().creationPending).toBe(true)
  await act(async () => finish(created))
  expect(mockReplace).toHaveBeenCalledTimes(1)
})
it('redirects non-users to sign in without creating', async () => {
  mockStatus = 'guest'
  await open(); await create()
  expect(mockPush).toHaveBeenCalledWith('/auth/sign-in?next=create')
  expect(mockCreate).not.toHaveBeenCalled()
  expect(mockPrepareInvite).not.toHaveBeenCalled()
})
it('has no recommendation search or states and reserves the footer inset', async () => {
  await open()
  expect(mockSearch).not.toHaveBeenCalled()
  expect(screen.queryByTestId('create-places-selected')).toBeNull()
  expect(screen.queryByTestId('create-places-suggestions-title')).toBeNull()
  await fireEvent(screen.getByTestId('create-footer'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 100 } } })
  expect(StyleSheet.flatten(screen.getByTestId('create-places-list').props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(100)
})
it('selected X stays inside the 16pt gutter and removing re-enables the capped picker', async () => {
  for (let n = 0; n < MAX_SEED_PLACES; n++) useRoomStore.getState().addSeedPlace({ placeId: `seed-${n}`, name: `Seed ${n}` })
  await open()
  await screen.findAllByTestId('place-card-remove')
  expect(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeDisabled()
  const list = StyleSheet.flatten(screen.getByTestId('create-places-seed-list').props.style)
  const content = StyleSheet.flatten(screen.getByTestId('create-places-list').props.contentContainerStyle)
  const remove = StyleSheet.flatten(screen.getAllByTestId('place-card-remove')[0].props.style)
  expect(content.paddingHorizontal + list.paddingRight + remove.right).toBe(16)
  expect(list.paddingTop + remove.top).toBeGreaterThanOrEqual(0)
  await fireEvent.press(screen.getAllByTestId('place-card-remove')[0])
  expect(screen.getByRole('header', { name: i18n.t('createPlaces.selected', { count: 9 }) })).toBeTruthy()
  expect(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeEnabled()
})
it('removes the mood route and maps cold/warm legacy links to places', () => {
  expect(existsSync(resolve(__dirname, '../../../app/create/mood.tsx'))).toBe(false)
  for (const initial of [true, false]) for (const path of ['/create/mood', 'gogo://create/mood', 'https://gogo.app/create/mood?old=1']) {
    expect(redirectSystemPath({ path, initial })).toBe('/create/places')
  }
})

it.each(['vi', 'en'])('selected group hides after last X with optional wizard copy (%s)', async locale => {
  await i18n.changeLanguage(locale)
  useRoomStore.getState().addSeedPlace({ placeId: 'one', name: 'Place one' })
  await open()
  expect(screen.getByText(i18n.t('createPlaces.selected', { count: 1 }))).toBeTruthy()
  expect(screen.getByText(i18n.t('createPlaces.body'))).toBeTruthy()
  await fireEvent.press(screen.getByTestId('place-card-remove'))
  expect(screen.queryByTestId('create-places-selected')).toBeNull()
  expect(mockSearch).not.toHaveBeenCalled()
})

it.each([true, false])('round 6v: normalizes cold/warm legacy group step links (initial %s)', initial => {
  for (const path of ['/create/group-setup', 'gogo://create/group-setup', 'https://gogo.app/create/group-setup?old=1']) {
    expect(redirectSystemPath({ path, initial })).toBe('/create/budget')
  }
})
