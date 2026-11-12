import { useRoomStore } from '@/shared/store/roomStore'
import { freshDay, scheduleToIso } from './schedule-day'

/** Only unsent drafts may advance to today; an attempted request must replay unchanged. */
export function dropStaleDay(now = new Date()) {
  const { creationAttempt, scheduleDay, startTime, endTime, patchDraft } = useRoomStore.getState()
  if (creationAttempt) return
  if (scheduleDay === null || freshDay(scheduleDay, now) === scheduleDay) return
  patchDraft({ scheduleDay: null, ...scheduleToIso(startTime, endTime, null, now) })
}
