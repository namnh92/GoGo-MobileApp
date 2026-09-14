import { act, fireEvent } from '@testing-library/react-native'

import { renderScreen } from './harness'

/**
 * APP-051 (#204): a length preset needs a start time, fills in the end from
 * it, and never unlocks Continue on its own.
 */

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
    fireEvent.press(element)
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

it('keeps Continue locked for a length alone and never invents a start', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  await press(view.getByText('2–3 giờ'))
  expect(selected(view, '2–3 giờ')).toBe(true)
  expect(view.getByText('Chọn giờ bắt đầu — GoGo sẽ tính giờ kết thúc theo thời lượng này.')).toBeTruthy()
  await press(view.getByText('Tiếp tục'))
  expect(mockPush).not.toHaveBeenCalled()
  expect(useRoomStore.getState()).toMatchObject({ startTime: null, endTime: null, startAt: null })
})

it('works out the end from the start and sends both instants', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  await press(view.getByText('2–3 giờ'))
  await pickStart(view, '19:00')
  expect(view.getByText('22:00')).toBeTruthy()
  await press(view.getByText('Tiếp tục'))
  expect(mockPush).toHaveBeenCalledWith('/create/budget')
  expect(windowLength()).toBe(3 * HOUR)
})

it('rolls a length that crosses midnight into the next day', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  await pickStart(view, '23:00')
  await press(view.getByText('1–2 giờ'))
  expect(view.getByText('01:00')).toBeTruthy()
  expect(view.getByText('(hôm sau)')).toBeTruthy()
  await press(view.getByText('Tiếp tục'))
  expect(windowLength()).toBe(2 * HOUR)
})

it('restores a saved length and lets a hand-picked end replace it', async () => {
  useRoomStore.setState({ startTime: '19:00', endTime: '22:00', durationPreset: 'upTo3h' })
  const view = await renderScreen(<CreateTimeScreen />)
  expect(selected(view, '2–3 giờ')).toBe(true)
  await press(view.getByText('Kết thúc'))
  await press(view.getByText('21:00'))
  expect(selected(view, '2–3 giờ')).toBe(false)
  expect(useRoomStore.getState()).toMatchObject({ endTime: '21:00', durationPreset: null })
})

it('removes only the end a deselected length produced', async () => {
  const view = await renderScreen(<CreateTimeScreen />)
  await pickStart(view, '19:00')
  await press(view.getByText('3–4 giờ'))
  expect(useRoomStore.getState().endTime).toBe('23:00')
  await press(view.getByText('3–4 giờ'))
  expect(useRoomStore.getState()).toMatchObject({ endTime: null, durationPreset: null })
})

it('drops an end that a later start overtakes, and treats "Cả tối" as no end', async () => {
  useRoomStore.setState({ startTime: '19:00', endTime: '21:00', durationPreset: null })
  const view = await renderScreen(<CreateTimeScreen />)
  await pickStart(view, '22:00')
  expect(useRoomStore.getState().endTime).toBeNull()
  await press(view.getByText('Cả tối'))
  expect(view.getByText('Không cố định')).toBeTruthy()
  await press(view.getByText('Tiếp tục'))
  expect(useRoomStore.getState()).toMatchObject({ endAt: null })
  expect(mockPush).toHaveBeenCalledWith('/create/budget')
})
