import { AccessibilityInfo, FlatList, StyleSheet } from 'react-native'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { render } from '@/shared/ui/__tests__/query-render'
import { MAX_SEED_PLACES } from '@/shared/store/roomStore'
import { spacing } from '@/shared/ui/tokens'
import { loaded, roomFor } from './harness'
import type { RoomSummary, useSeedPlaceDetails } from '@/shared/api'
import { RoomSeeds } from '../gogo-room/room-seeds.view'

const mockPush = jest.fn()
const mockRemove = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => undefined }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useTaxonomies: () => ({ data: undefined }),
  useRemoveRoomSeedPlace: () => ({ mutate: mockRemove }),
}))

const area = { datasetVersion: 'v1', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null, status: 'current' as const }
function props(count: number, role: 'host' | 'member' | 'guest' = 'host') {
  const seedPlaces = Array.from({ length: count }, (_, index) => ({ placeId: `seed-${index}`, name: `Place ${index}` }))
  return {
    room: roomFor('group-host', { myRole: role as RoomSummary['myRole'], seedPlaces, constraints: { administrativeArea: area, budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND' } }),
    details: { byPlaceId: new Map(seedPlaces.map(seed => [seed.placeId, loaded({ id: seed.placeId, name: seed.name })])) } as ReturnType<typeof useSeedPlaceDetails>,
    onRefresh: jest.fn(async () => undefined),
  }
}
beforeEach(() => {
  // Own FlatList's delayed cell-batching work, which can fire between act calls under load.
  jest.useFakeTimers()
  jest.clearAllMocks()
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})
afterEach(async () => {
  try {
    await act(async () => { jest.runOnlyPendingTimers() })
  } finally {
    jest.restoreAllMocks()
    jest.useRealTimers()
  }
})

it.each([2, 3, MAX_SEED_PLACES])('renders %i real cards in one labelled horizontal snapped row', async count => {
  await render(<RoomSeeds {...props(count)} />)
  const row = screen.getByTestId('room-lobby-seeds-list').props
  expect(row.horizontal).toBe(true)
  expect(row.snapToInterval).toBeGreaterThan(0)
  expect(row.disableIntervalMomentum).toBe(true)
  expect(screen.getByLabelText('Địa điểm gợi ý')).toBeTruthy()
  expect(screen.getAllByTestId('place-card-small')).toHaveLength(count)
  // FlatList starts in the middle copy; the preceding copy mounts when scrolling back.
  expect(screen.getAllByTestId('room-lobby-seed-item', { includeHiddenElements: true }).length).toBeGreaterThan(count)
  for (const card of screen.getAllByTestId('place-card-open-target')) {
    expect(card.props).toMatchObject({ focusable: true, accessible: true })
  }
  const widths = screen.getAllByTestId('room-lobby-seed-item').map(item => StyleSheet.flatten(item.props.style).width)
  expect(new Set(widths).size).toBe(1)
})
it.each([false, true])('insets cards equally and sizes against the measured row (loading: %s)', async loading => {
  const input = props(1)
  if (loading) {
    for (const detail of input.details.byPlaceId.values()) Object.assign(detail, { data: undefined, isPending: true, isFetching: true })
  }
  await render(<RoomSeeds {...input} />)
  let row = screen.getByTestId('room-lobby-seeds-list')
  await fireEvent(row, 'layout', { nativeEvent: { layout: { width: 360, height: 240, x: 0, y: 0 } } })
  row = screen.getByTestId('room-lobby-seeds-list')
  const inset = spacing[4]
  const contentWidth = 360 - inset * 2
  expect(StyleSheet.flatten(row.props.style).marginHorizontal).toBe(-inset)
  expect(StyleSheet.flatten(row.props.contentContainerStyle).paddingHorizontal).toBe(inset)
  expect(StyleSheet.flatten(screen.getByTestId('room-lobby-seed-item').props.style).width).toBe(contentWidth)
  expect(row.props.scrollEnabled).toBe(false)
  if (loading) expect(screen.getByTestId('place-card-small-loading')).toBeTruthy()

  const multiple = props(2)
  if (loading) {
    for (const detail of multiple.details.byPlaceId.values()) Object.assign(detail, { data: undefined, isPending: true, isFetching: true })
  }
  await screen.rerender(<RoomSeeds {...multiple} />)
  row = screen.getByTestId('room-lobby-seeds-list')
  const cardWidth = StyleSheet.flatten(screen.getAllByTestId('room-lobby-seed-item')[0].props.style).width
  expect(cardWidth).toBe(contentWidth - spacing[8])
  expect(cardWidth).toBeLessThan(contentWidth)
  const separator = row.props.ItemSeparatorComponent()
  const gap = StyleSheet.flatten(separator.props.style).width
  expect(gap).toBe(inset)
  expect(row.props.snapToInterval).toBe(cardWidth + gap)
  expect(row.props.snapToAlignment).toBe('start')
  expect(row.props.scrollEnabled).toBe(true)
  // The item starts at inset + index * stride; each snapped scroll offset
  // removes only index * stride, preserving the inset at rest.
  for (const index of [0, multiple.room.seedPlaces!.length, 4]) {
    const offset = row.props.getItemLayout(undefined, index).offset
    expect(inset + index * row.props.snapToInterval - offset).toBe(inset)
    // The preceding card ends at the clip edge; the following card still peeks.
    expect(inset + (index - 1) * row.props.snapToInterval + cardWidth - offset).toBe(0)
    expect(inset + (index + 1) * row.props.snapToInterval - offset).toBeLessThan(360)
  }
})
it('disables the header + at the limit, explains why and still lets the host remove', async () => {
  await render(<RoomSeeds {...props(MAX_SEED_PLACES)} />)
  const add = screen.getByTestId('room-lobby-seeds-add')
  expect(add).toBeDisabled()
  expect(screen.getByText('Tối đa 10 địa điểm gợi ý. Bỏ một địa điểm để thêm địa điểm khác.')).toBeTruthy()
  expect(add.props.accessibilityHint).toContain('10')
  await fireEvent.press(add)
  expect(mockPush).not.toHaveBeenCalled()
  expect(screen.getAllByTestId('place-card-remove')).toHaveLength(MAX_SEED_PLACES)
})
it.each(['guest', 'member'] as const)('shows no add/remove controls to a %s', async role => {
  await render(<RoomSeeds {...props(3, role)} />)
  expect(screen.getAllByTestId('place-card-small')).toHaveLength(3)
  expect(screen.queryByTestId('room-lobby-seeds-add')).toBeNull()
  expect(screen.queryAllByTestId('place-card-remove', { includeHiddenElements: true })).toHaveLength(0)
})
it('keeps the host + enabled below the limit and removes the real seed from a loop copy', async () => {
  await render(<RoomSeeds {...props(2)} />)
  expect(screen.getByTestId('room-lobby-seeds-add')).toBeEnabled()
  // An outer copy is hidden from accessibility but remains a visual touch target.
  const copy = screen.getAllByTestId('room-lobby-seed-item', { includeHiddenElements: true }).find(item => item.props.accessibilityElementsHidden)!
  await fireEvent.press(within(copy).getByTestId('place-card-remove', { includeHiddenElements: true }))
  await fireEvent.press(within(screen.getByTestId('room-lobby-seed-confirm')).getByRole('button', { name: 'Xoá' }))
  expect(mockRemove).toHaveBeenCalledWith('seed-0', expect.any(Object))
})
it.each([1, 4])('silently recenters an outer copy at virtual index %i', async index => {
  await render(<RoomSeeds {...props(2)} />)
  const row = screen.getByTestId('room-lobby-seeds-list')
  const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => {})
  const stride = row.props.snapToInterval
  await fireEvent(row, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: index * stride, y: 0 } } })
  expect(scroll).toHaveBeenCalledWith({ offset: (2 + index % 2) * stride, animated: false })
})
it.each(['screenReader', 'reduceMotion'] as const)('uses a single non-looping copy with %s enabled', async preference => {
  if (preference === 'screenReader') jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true)
  else jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  await render(<RoomSeeds {...props(3)} />)
  const row = screen.getByTestId('room-lobby-seeds-list').props
  expect(row.horizontal).toBe(true)
  expect(screen.getAllByTestId('place-card-small', { includeHiddenElements: true })).toHaveLength(3)
})
it('switches to the non-looping row when a screen reader is turned on', async () => {
  const listen = jest.spyOn(AccessibilityInfo, 'addEventListener')
  await render(<RoomSeeds {...props(2)} />)
  const calls = listen.mock.calls as unknown as [string, (enabled: boolean) => void][]
  const update = calls.find(([event]) => event === 'screenReaderChanged')![1]
  await act(async () => { update(true) })
  expect(screen.getAllByTestId('place-card-small', { includeHiddenElements: true })).toHaveLength(2)
})
it('keeps one seed static and the zero-seed empty state unchanged', async () => {
  await render(<RoomSeeds {...props(1)} />)
  expect(screen.getByTestId('room-lobby-seeds-list').props.scrollEnabled).toBe(false)
  expect(screen.getAllByTestId('place-card-small')).toHaveLength(1)
  await screen.rerender(<RoomSeeds {...props(0)} />)
  expect(screen.queryByTestId('room-lobby-seeds-list')).toBeNull()
  expect(screen.getByText('Chưa có địa điểm gợi ý.')).toBeTruthy()
})
it('keeps detail skeletons in the same horizontal row', async () => {
  const input = props(3)
  for (const detail of input.details.byPlaceId.values()) Object.assign(detail, { data: undefined, isPending: true, isFetching: true })
  await render(<RoomSeeds {...input} />)
  expect(screen.getByTestId('room-lobby-seeds-list').props.horizontal).toBe(true)
  expect(screen.getAllByTestId('place-card-small-loading')).toHaveLength(3)
})
