import { useRoomStore } from '@/shared/store/roomStore'
import { freshDay, scheduleToIso } from './schedule-day'

/** A resumed draft whose day has passed goes back to today, and its instants are rebuilt from the times. */
export function dropStaleDay(now = new Date()) {
  const { scheduleDay, startTime, endTime, patchDraft } = useRoomStore.getState()
  if (scheduleDay === null || freshDay(scheduleDay, now) === scheduleDay) return
  patchDraft({ scheduleDay: null, ...scheduleToIso(startTime, endTime, null, now) })
}
