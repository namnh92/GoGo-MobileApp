import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/** #501 / #594 round 2: inline dates and staged start/end time wheels. */

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
import { loadRoomDraft, restoreRoomDraft, saveRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'

const HOUR = 3_600_000
type View = Awaited<ReturnType<typeof renderScreen>>

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}
const state = (view: View, testID: string) => view.getByTestId(testID).props.accessibilityState
async function openSheet(view: View) {
  await press(view.getByTestId('create-time-start-row'))
}
async function chooseTime(view: View, slot: string) {
  await press(view.getByTestId(`start-time-sheet-wheel-hours-${slot.slice(0, 2)}`))
  await press(view.getByTestId(`start-time-sheet-wheel-minutes-${slot.slice(3)}`))
}
async function pickStart(view: View, slot: string) {
  await openSheet(view)
  await chooseTime(view, slot)
  await press(view.getByText('Xong'))
}
const windowLength = () => {
  const { startAt, endAt } = useRoomStore.getState()
  return new Date(endAt as string).getTime() - new Date(startAt as string).getTime()
}
const fakeClock = (now: Date) =>
  jest.useFakeTimers({
    now,
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
  })

// Thursday 5 November 2026, 10:00.
const NOW = new Date(2026, 10, 5, 10, 0, 0, 0)

beforeEach(() => {
  fakeClock(NOW)
  useRoomStore.getState().resetDraft()
  mockPush.mockClear()
})
afterEach(() => jest.useRealTimers())

const startOf = () => new Date(useRoomStore.getState().startAt as string)

describe('the start and end rows', () => {
  it('show day and time on one line, today first, and open the sheet from Bắt đầu', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    expect(view.getByText('T5, 05/11 · --:--')).toBeTruthy()
    expect(view.queryByTestId('date-time-sheet')).toBeNull()
    await openSheet(view)
    expect(view.getByTestId('start-time-sheet')).toBeTruthy()
    expect(view.getByText('Chọn giờ · Bắt đầu')).toBeTruthy()
  })

  it('ignoring the day sends today, exactly as before', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await pickStart(view, '19:00')
    expect(view.getByText('T5, 05/11 · 19:00')).toBeTruthy()
    await press(view.getByText('Tiếp tục'))
    expect(useRoomStore.getState().scheduleDay).toBeNull()
    expect(startOf().getDate()).toBe(5)
    expect(mockPush).toHaveBeenCalledWith('/create/budget')
  })

  it('a start already over today is shown as invalid and blocks Continue instead of rolling to tomorrow', async () => {
    useRoomStore.setState({ startTime: '09:00' })
    const view = await renderScreen(<CreateTimeScreen />)
    expect(view.getByText('T5, 05/11 · 09:00')).toBeTruthy()
    expect(view.getByText('Giờ bắt đầu hôm nay đã qua — chọn giờ khác hoặc ngày khác.')).toBeTruthy()
    await press(view.getByText('Tiếp tục'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(useRoomStore.getState().startAt).toBeNull()
  })

  it('the same start on tomorrow is valid', async () => {
    useRoomStore.setState({ startTime: '09:00', scheduleDay: '2026-11-06' })
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByText('Tiếp tục'))
    expect(startOf().getDate()).toBe(6)
    expect(startOf().getHours()).toBe(9)
  })

  it('an end past midnight lands on the day after the chosen day, and the estimate still reads', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-day-2026-11-07'))
    await openSheet(view)
    await chooseTime(view, '23:00')
    await press(view.getByText('Xong'))
    await press(view.getByText('1–2 giờ'))
    expect(view.getByText('(hôm sau)')).toBeTruthy()
    expect(view.getByText('CN, 08/11 · 01:00')).toBeTruthy()
    expect(view.getByText('Dự kiến: ~2 giờ trải nghiệm')).toBeTruthy()
    await press(view.getByText('Tiếp tục'))
    const { startAt, endAt } = useRoomStore.getState()
    expect(new Date(startAt as string).getDate()).toBe(7)
    expect(new Date(endAt as string).getDate()).toBe(8)
    expect(windowLength()).toBe(2 * HOUR)
  })

  it('Kết thúc opens the staged wheel for a time', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await pickStart(view, '19:00')
    await press(view.getByTestId('create-time-end-row'))
    await press(view.getByTestId('end-time-sheet-wheel-hours-21'))
    await press(view.getByTestId('end-time-sheet-wheel-minutes-00'))
    await press(view.getByText('Xong'))
    expect(view.getByText('T5, 05/11 · 21:00')).toBeTruthy()
    expect(useRoomStore.getState().endTime).toBe('21:00')
  })
})

describe('the inline calendar and time wheel', () => {
  it('starts with one week, expands to the month, and collapses back without date shortcuts', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    expect(view.getAllByTestId('date-inline-week')).toHaveLength(1)
    expect(view.queryByText('Cuối tuần này')).toBeNull()
    expect(view.queryByTestId('date-sheet-shortcut-today')).toBeNull()
    expect(state(view, 'date-inline-day-2026-11-05').selected).toBe(true)
    await press(view.getByTestId('date-inline-expand'))
    expect(view.getAllByTestId('date-inline-week')).toHaveLength(6)
    await press(view.getByTestId('date-inline-expand'))
    expect(view.getAllByTestId('date-inline-week')).toHaveLength(1)
    expect(state(view, 'date-inline-day-2026-11-05').selected).toBe(true)
  })

  it('past days are disabled, and the previous month is disabled on the current month', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    expect(state(view, 'date-inline-day-2026-11-04').disabled).toBe(true)
    expect(state(view, 'date-inline-day-2026-11-06').disabled).toBe(false)
    expect(state(view, 'date-sheet-prev').disabled).toBe(true)
    await press(view.getByTestId('date-sheet-next'))
    expect(view.getByText('Tháng 12, 2026')).toBeTruthy()
    expect(state(view, 'date-sheet-prev').disabled).toBe(false)
  })

  it('weeks start on Monday', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-expand'))
    // 1 November 2026 is a Sunday: the first week holds only that day, in the last column.
    expect(view.getByTestId('date-inline-day-2026-11-01')).toBeTruthy()
    expect(view.getAllByText('T2').length).toBe(1)
  })

  it('tomorrow gives startAt tomorrow, even for a slot earlier than now', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-day-2026-11-06'))
    await openSheet(view)
    await chooseTime(view, '09:00')
    await press(view.getByText('Xong'))
    expect(view.getByText('T6, 06/11 · 09:00')).toBeTruthy()
    await press(view.getByText('Tiếp tục'))
    expect(useRoomStore.getState().scheduleDay).toBe('2026-11-06')
    expect(startOf().getDate()).toBe(6)
    expect(startOf().getHours()).toBe(9)
  })

  it('a day beyond the old four-day row works', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-sheet-next'))
    await press(view.getByTestId('date-inline-expand'))
    await press(view.getByTestId('date-inline-day-2026-12-25'))
    await openSheet(view)
    await chooseTime(view, '19:00')
    await press(view.getByText('Xong'))
    expect(view.getByText('T6, 25/12 · 19:00')).toBeTruthy()
    await press(view.getByText('Tiếp tục'))
    expect(useRoomStore.getState().scheduleDay).toBe('2026-12-25')
    expect(startOf().getMonth()).toBe(11)
    expect(startOf().getDate()).toBe(25)
  })

  it('removes time presets and prevents confirming a past wheel time', async () => {
    fakeClock(new Date(2026, 10, 5, 18, 30, 0, 0))
    const view = await renderScreen(<CreateTimeScreen />)
    await openSheet(view)
    expect(view.queryByTestId('date-sheet-time-18:00')).toBeNull()
    await press(view.getByTestId('start-time-sheet-wheel-hours-18'))
    await press(view.getByTestId('start-time-sheet-wheel-minutes-00'))
    expect(view.getByRole('button', { name: 'Xong' }).props.accessibilityState.disabled).toBe(true)
    await press(view.getByTestId('start-time-sheet-wheel-hours-19'))
    expect(view.getByRole('button', { name: 'Xong' }).props.accessibilityState.disabled).toBe(false)
  })

  it('stages wheel edits until Done', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await openSheet(view)
    await chooseTime(view, '20:00')
    expect(useRoomStore.getState().startTime).toBeNull()
    await press(view.getByText('Xong'))
    expect(view.getByText('T5, 05/11 · 20:00')).toBeTruthy()
  })

  it('closing the wheel drops time edits and keeps the calendar date', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-day-2026-11-06'))
    await openSheet(view)
    await chooseTime(view, '19:00')
    await press(view.getByText('Huỷ'))
    expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2026-11-06', startTime: null })
  })

  it('a saved day that is still ahead is shown on the row and selected in the calendar', async () => {
    useRoomStore.setState({ scheduleDay: '2026-11-07', startTime: '19:00' })
    const view = await renderScreen(<CreateTimeScreen />)
    expect(view.getByText('T7, 07/11 · 19:00')).toBeTruthy()
    await openSheet(view)
    expect(state(view, 'date-inline-day-2026-11-07').selected).toBe(true)
    expect(state(view, 'date-inline-day-2026-11-05').selected).toBe(false)
  })
})

describe('Stitch inline calendar (#594)', () => {
  it('keeps an inline day without a time when cancelling the staged wheel (#594 F-01)', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-day-2026-11-06'))
    await openSheet(view)
    expect(state(view, 'date-inline-day-2026-11-06').selected).toBe(true)
    expect(state(view, 'date-inline-day-2026-11-05').selected).toBe(false)
    await chooseTime(view, '20:00')
    await press(view.getByText('Huỷ'))
    expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2026-11-06', startTime: null, startAt: null })
    await openSheet(view)
    expect(state(view, 'date-inline-day-2026-11-06').selected).toBe(true)
    await chooseTime(view, '19:00')
    expect(useRoomStore.getState().startTime).toBeNull()
    await press(view.getByText('Xong'))
    expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2026-11-06', startTime: '19:00' })
  })

  it('saves and resumes an inline day before choosing any time (#594 F-01)', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-day-2026-11-07'))
    await saveRoomDraft('user-1', 'time')
    await view.unmount()
    useRoomStore.getState().resetDraft()
    useSavedRoomDraft.setState({ draft: null })
    await loadRoomDraft('user-1')
    expect(restoreRoomDraft('user-1')).toBe('time')
    const resumed = await renderScreen(<CreateTimeScreen />)
    expect(state(resumed, 'date-inline-day-2026-11-07').selected).toBe(true)
    expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2026-11-07', startTime: null, startAt: null })
    await press(resumed.getByText('Tiếp tục'))
    expect(mockPush).not.toHaveBeenCalled()
    await openSheet(resumed)
    expect(state(resumed, 'date-inline-day-2026-11-07').selected).toBe(true)
  })

  it('uses the existing schedule path for an inline day and time', async () => {
    const view = await renderScreen(<CreateTimeScreen />)
    await press(view.getByTestId('date-inline-day-2026-11-06'))
    await pickStart(view, '19:00')
    expect(useRoomStore.getState().scheduleDay).toBe('2026-11-06')
    expect(useRoomStore.getState().startTime).toBe('19:00')
    await press(view.getByText('Tiếp tục'))
    expect(startOf().getDate()).toBe(6)
    expect(mockPush).toHaveBeenCalledWith('/create/budget')
  })

  it('Huỷ cancels staged wheel edits and keeps the saved start', async () => {
    useRoomStore.setState({ startTime: '18:00' })
    const view = await renderScreen(<CreateTimeScreen />)
    await openSheet(view)
    await chooseTime(view, '20:00')
    await press(view.getByText('Huỷ'))
    expect(useRoomStore.getState().scheduleDay).toBeNull()
    expect(useRoomStore.getState().startTime).toBe('18:00')
    expect(view.queryByTestId('date-time-sheet')).toBeNull()
  })
})

it('blocks Continue when an inline change puts the saved time in the past', async () => {
  useRoomStore.setState({ startTime: '09:00', scheduleDay: '2026-11-06' })
  const view = await renderScreen(<CreateTimeScreen />)
  await press(view.getByTestId('date-inline-day-2026-11-05'))
  expect(useRoomStore.getState().scheduleDay).toBeNull()
  expect(view.getByText('Giờ bắt đầu hôm nay đã qua — chọn giờ khác hoặc ngày khác.')).toBeTruthy()
  await press(view.getByText('Tiếp tục'))
  expect(mockPush).not.toHaveBeenCalled()
})

it('returns from inline other-time slots without inventing a start', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  await press(view.getByTestId('create-time-start-row'))
  await press(view.getByText('Huỷ'))
  expect(view.getByTestId('date-inline-day-2026-11-05')).toBeTruthy()
  expect(useRoomStore.getState().startTime).toBeNull()
})
