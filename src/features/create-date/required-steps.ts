import { z } from 'zod'
import type { useRoomStore } from '@/shared/store/roomStore'
import { budgetAmountSchema } from './budget-picker'
import { isPastSlot } from './calendar'
import { freshDay } from './schedule-day'

export const WIZARD_MAX_PARTICIPANTS = 12
export const wizardParticipantCountSchema = z.number().int().min(3).max(WIZARD_MAX_PARTICIPANTS)
const slotSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

/** Recheck in wizard order: restored drafts may have skipped required fields.
 * Location, title and end time remain optional, as on their normal steps. */
export function firstInvalidRequiredStep(state: ReturnType<typeof useRoomStore.getState>, now = new Date()): 'type' | 'time' | 'budget' | null {
  if (state.title.trim().length > 80) return 'type'
  if (!slotSchema.safeParse(state.startTime).success
    || isPastSlot(state.startTime!, freshDay(state.scheduleDay, now), now)
    || !state.startAt || !(Date.parse(state.startAt) > now.getTime())) return 'time'
  if (!budgetAmountSchema.safeParse(state.budgetAmount).success
    || (state.audience !== 'couple' && !wizardParticipantCountSchema.safeParse(state.participantCount).success)) return 'budget'
  return null
}
