import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/** #501: the day row on the time step. */

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'user-1' } }),
}))

import CreateTimeScreen from '@/features/create-date/create-time.view'
import { useRoomStore } from '@/shared/store/roomStore'

const HOUR = 3_600_000
type View = Awaited<ReturnType<typeof renderScreen>>

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}
const selected = (view: View, label: string) =>
  view.getByRole('button', { name: label }).props.accessibilityState?.selected
async function pickStart(view: View, slot: string) {
  await press(view.getByText('Bắt đầu *'))
  await press(view.getByText(slot))
}
const windowLength = () => {
  const { startAt, endAt } = useRoomStore.getState()
  return new Date(endAt as string).getTime() - new Date(startAt as string).getTime()
}

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  mockPush.mockClear()
})

describe('the day row (#501)', () => {
  const NOW = new Date(2026, 10, 5, 10, 0, 0, 0)
  beforeEach(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
    })
  })
  afterEach(() => jest.useRealTimers())
  const startOf = () => new Date(useRoomStore.getState().startAt as string)

  it('offers four days with today selected', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    expect(selected(view, 'Hôm nay')).toBe(true)
    expect(selected(view, 'Ngày mai')).toBe(false)
    expect(view.getByTestId('create-time-day-2026-11-08')).toBeTruthy()
    expect(view.queryByTestId('create-time-day-2026-11-09')).toBeNull()
  })

  it('ignoring the row sends today, exactly as before', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await pickStart(view, '19:00')
    await press(view.getByText('Tiếp tục'))
    expect(useRoomStore.getState().scheduleDay).toBeNull()
    expect(startOf().getDate()).toBe(5)
  })

  it('a start already past today still means tomorrow, with no new rule', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await pickStart(view, '09:00')
    await press(view.getByText('Tiếp tục'))
    expect(startOf().getDate()).toBe(6)
  })

  it('choosing tomorrow puts startAt on tomorrow, even for an early slot', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByText('Ngày mai'))
    expect(selected(view, 'Ngày mai')).toBe(true)
    expect(selected(view, 'Hôm nay')).toBe(false)
    await pickStart(view, '09:00')
    await press(view.getByText('Tiếp tục'))
    expect(useRoomStore.getState().scheduleDay).toBe('2026-11-06')
    expect(startOf().getDate()).toBe(6)
    expect(startOf().getHours()).toBe(9)
  })

  it('an end past midnight lands on the day after the chosen day, and the estimate still reads', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('create-time-day-2026-11-07'))
    await pickStart(view, '23:00')
    await press(view.getByText('1–2 giờ'))
    expect(view.getByText('(hôm sau)')).toBeTruthy()
    expect(view.getByText('Dự kiến: ~2 giờ trải nghiệm')).toBeTruthy()
    await press(view.getByText('Tiếp tục'))
    const { startAt, endAt } = useRoomStore.getState()
    expect(new Date(startAt as string).getDate()).toBe(7)
    expect(new Date(endAt as string).getDate()).toBe(8)
    expect(windowLength()).toBe(2 * HOUR)
  })

  it('a saved day that is still ahead is shown selected', async () => {
    useRoomStore.setState({ scheduleDay: '2026-11-07' })
    const view = await renderScreen(<CreateTimeScreen />)
    expect(selected(view, 'Hôm nay')).toBe(false)
    expect(view.getByTestId('create-time-day-2026-11-07').props.accessibilityState.selected).toBe(true)
  })
})
