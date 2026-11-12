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
import { readPickerScope } from '@/shared/location/picker-scope'
import { redirectSystemPath } from '@/app/+native-intent'
import i18n from '@/shared/i18n'
import CreatePlaces from '../create-places.view'

let mockUuid = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }))
const mockSearch = jest.fn()
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
  getPlaceDetail: (id: string) => Promise.resolve({ id, name: `Place ${id}` }),
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  createAndOpenRoom: (...args: unknown[]) => mockCreate(...args),
}))
jest.mock('@/shared/analytics', () => ({ track: jest.fn() }))
jest.mock('@/shared/store/assistantIntroStore', () => ({ noteAssistantPlanCreated: (...args: unknown[]) => mockNoteCreated(...args) }))
const area = { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: '26734', provinceName: 'Hồ Chí Minh', communeName: 'Bến Thành' }
const found = (id: string) => ({ id, name: `Place ${id}`, isLodging: false })
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
  useRoomStore.getState().patchDraft({ administrativeArea: area, budgetAmount: 600001 })
  useAppAreaStore.setState({ area: null, scope: { status: 'resolving' } })
  useSavedRoomDraft.setState({ draft: null })
  useRecentRoomsStore.setState({ rooms: [] })
  await clearSavedRoomDraft()
  await i18n.changeLanguage('vi')
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

it.each([
  ['couple', 'per_person', 600001, 4, 300000, 'couple'],
  ['group-host', 'total', 800003, 4, 200000, 'group'],
  ['group-host', 'per_person', 200001, 6, 200001, 'group'],
  ['group-host', 'total', null, 4, undefined, 'group'],
  ['couple', 'total', 0, 4, undefined, 'couple'],
] as const)('sends canonical area and derived price: %s / %s / %s', async (audience, budgetMode, budgetAmount, participantCount, price, suitedFor) => {
  useRoomStore.setState({ audience, budgetMode, budgetAmount, participantCount })
  await open()
  await waitFor(() => expect(mockSearch).toHaveBeenCalled())
  const query = mockSearch.mock.calls[0][0]
  expect(query).toMatchObject({ datasetVersion: area.datasetVersion, provinceCode: area.provinceCode, communeCode: area.communeCode, suitedFor, limit: 10 })
  expect(query.priceMaxPerPerson).toBe(price)
  if (price === undefined) expect(query).not.toHaveProperty('priceMaxPerPerson')
  expect(query).not.toHaveProperty('lat')
})
it('uses the exact GPS radius in both search and the opaque + picker scope', async () => {
  useRoomStore.setState({ administrativeArea: null, originLat: 10.77, originLng: 106.7, radiusM: 5000 })
  await open()
  await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ lat: 10.77, lng: 106.7, radiusM: 5000, priceMaxPerPerson: 300000 })))
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') }))
  const href = mockPush.mock.calls[0][0]
  expect(href.pathname).toBe('/places/search')
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
it('shows first-page skeleton, empty/error/retry, and reserves the footer inset for every state', async () => {
  let finish!: (value: unknown) => void
  mockSearch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open()
  expect(screen.getByTestId('create-places-pending')).toBeTruthy()
  await fireEvent(screen.getByTestId('create-footer'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 100 } } })
  expect(StyleSheet.flatten(screen.getByTestId('create-places-list').props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(100)
  await act(async () => finish({ results: [], nextCursor: null }))
  expect(await screen.findByText(i18n.t('createPlaces.empty'))).toBeTruthy()
  mockSearch.mockRejectedValueOnce(new Error('server'))
  await act(async () => { await client.invalidateQueries({ queryKey: ['places'] }) })
  expect(await screen.findByTestId('create-places-error')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.retry') }))
  expect(await screen.findByText(i18n.t('createPlaces.empty'))).toBeTruthy()
})
it('shows offline instead of a skeleton while keeping zero-seed creation possible', async () => {
  onlineManager.setOnline(false)
  await open()
  expect(screen.getByText(i18n.t('common.offlineTitle'))).toBeTruthy()
  expect(screen.queryByTestId('create-places-pending')).toBeNull()
  expect(mockSearch).not.toHaveBeenCalled()
})
it('adds/removes with selected state and check glyph, caps additions, preserves top-right X', async () => {
  mockSearch.mockResolvedValue({ results: [found('one'), found('two')], nextCursor: null })
  await open()
  await fireEvent.press(await screen.findByRole('button', { name: 'Thêm Place one vào danh sách' }))
  expect(screen.getByRole('button', { name: 'Bỏ Place one khỏi danh sách', selected: true })).toBeTruthy()
  expect(screen.getByTestId('icon-check', { includeHiddenElements: true })).toBeTruthy()
  expect(within(screen.getByTestId('create-places-seed-list')).getByTestId('place-card-remove')).toBeTruthy()
  await act(async () => {
    for (let n = 1; n < MAX_SEED_PLACES; n++) useRoomStore.getState().addSeedPlace({ placeId: `seed-${n}`, name: `Seed ${n}` })
  })
  expect(screen.getByRole('button', { name: 'Thêm Place two vào danh sách' })).toBeDisabled()
  expect(screen.getByRole('button', { name: i18n.t('createPlaces.addPlace') })).toBeDisabled()
  expect(screen.getByText(i18n.t('placeWizard.selectionLimitHint', { max: 10 }))).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Bỏ Place one khỏi danh sách', selected: true }))
  expect(screen.getByRole('button', { name: 'Thêm Place two vào danh sách' })).toBeEnabled()
  expect(useRoomStore.getState().seedPlaces).toHaveLength(9)
})
it('loads pages of ten, keeps rows on footer failure, retries cursor and refreshes from page one', async () => {
  mockSearch.mockResolvedValueOnce({ results: [found('one')], nextCursor: 'next' })
    .mockRejectedValueOnce(new Error('page failure'))
    .mockResolvedValueOnce({ results: [found('two')], nextCursor: null })
    .mockResolvedValueOnce({ results: [found('fresh')], nextCursor: null })
  await open()
  await screen.findByText('Place one')
  await fireEvent(screen.getByTestId('create-places-list'), 'endReached')
  const footer = await screen.findByTestId('create-places-footer-error')
  expect(screen.getByText('Place one')).toBeTruthy()
  expect(mockSearch.mock.calls[1][0]).toMatchObject({ limit: 10, cursor: 'next' })
  await fireEvent.press(within(footer).getByRole('button', { name: i18n.t('common.retry') }))
  expect(await screen.findByText('Place two')).toBeTruthy()
  expect(mockSearch.mock.calls[2][0]).toMatchObject({ limit: 10, cursor: 'next' })
  const control = screen.getByTestId('create-places-list').props.refreshControl
  await act(async () => { control.props.onRefresh() })
  expect(await screen.findByText('Place fresh')).toBeTruthy()
  expect(screen.queryByText('Place one')).toBeNull()
  expect(mockSearch.mock.calls[3][0].cursor).toBeUndefined()
})
it('removes the mood route and maps cold/warm legacy links to places', () => {
  expect(existsSync(resolve(__dirname, '../../../app/create/mood.tsx'))).toBe(false)
  for (const initial of [true, false]) for (const path of ['/create/mood', 'gogo://create/mood', 'https://gogo.app/create/mood?old=1']) {
    expect(redirectSystemPath({ path, initial })).toBe('/create/places')
  }
})
