import { beforeEach, expect, it } from 'vitest'

import { useRoomStore } from '@/shared/store/roomStore'
import { dropStaleDay } from '../resume-day'

const now = new Date(2026, 7, 27, 20, 0, 0, 0)

beforeEach(() => useRoomStore.getState().resetDraft())

it('a resumed draft whose day has passed falls back to today and rebuilds its instants', () => {
  useRoomStore.setState({ startTime: '21:00', endTime: '23:00', scheduleDay: '2026-08-20', startAt: '2026-08-20T14:00:00.000Z', endAt: '2026-08-20T16:00:00.000Z' })
  dropStaleDay(now)
  const { scheduleDay, startAt, endAt } = useRoomStore.getState()
  expect(scheduleDay).toBeNull()
  expect(new Date(startAt as string).getDate()).toBe(27)
  expect(new Date(startAt as string).getHours()).toBe(21)
  expect(new Date(endAt as string).getDate()).toBe(27)
})

it('leaves a day that is still ahead, and a draft with no day, alone', () => {
  useRoomStore.setState({ startTime: '21:00', scheduleDay: '2026-08-29', startAt: '2026-08-29T14:00:00.000Z' })
  dropStaleDay(now)
  expect(useRoomStore.getState()).toMatchObject({ scheduleDay: '2026-08-29', startAt: '2026-08-29T14:00:00.000Z' })
  useRoomStore.getState().resetDraft()
  dropStaleDay(now)
  expect(useRoomStore.getState()).toMatchObject({ scheduleDay: null, startAt: null })
})
