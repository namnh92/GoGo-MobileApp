import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { openStateFromHours } from '@/shared/api/view-models'
import { usePlaceClock } from '../use-place-clock'

const hours = [{ dayOfWeek: 6, openMinute: 9 * 60, closeMinute: 16 * 60 }]
let resume: (status: AppStateStatus) => void
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-07T15:59:00+07:00'))
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    resume = listener
    return { remove: jest.fn() }
  })
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

it('crosses the closing time while the detail remains open', async () => {
  const { result } = await renderHook(() => openStateFromHours(hours, usePlaceClock()))
  expect(result.current.openNow).toBe(true)
  await act(async () => { jest.advanceTimersByTime(60_000) })
  expect(result.current.openNow).toBe(false)
})

it('refreshes immediately after a suspended app resumes', async () => {
  const { result } = await renderHook(() => openStateFromHours(hours, usePlaceClock()))
  jest.setSystemTime(new Date('2026-11-07T18:00:00+07:00'))
  await act(async () => { resume('active') })
  expect(result.current.openNow).toBe(false)
})
