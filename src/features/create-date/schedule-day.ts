import { endSlotToIso, slotToIso } from './schedule'

/** How many days the day row offers, today first (the draft shows four). */
export const DAY_CHOICES = 4

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** A local calendar day as `YYYY-MM-DD`, in the device's time zone. */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dayStart(key: string): Date | null {
  const match = DAY_KEY.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return localDayKey(date) === key ? date : null
}

/** Today and the next days, each at local midnight, for the day row. */
export function upcomingDays(now = new Date(), count = DAY_CHOICES): { key: string; date: Date }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    return { key: localDayKey(date), date }
  })
}

/**
 * The base date the slot helpers resolve against. No day, today, a day that has
 * passed or a malformed one is `now`, so the row left alone behaves as it always
 * did; a later day is its own local midnight, so every slot on it is "ahead".
 */
export function dayBase(dayKey: string | null, now = new Date()): Date {
  const start = dayKey ? dayStart(dayKey) : null
  if (!start || localDayKey(start) <= localDayKey(now)) return now
  return start
}

/** A saved day that has passed falls back to today (`null`); a later one is kept. */
export function freshDay(dayKey: string | null, now = new Date()): string | null {
  const start = dayKey ? dayStart(dayKey) : null
  return start && localDayKey(start) > localDayKey(now) ? dayKey : null
}

/** The `startAt` and `endAt` the draft carries for two slots on a chosen day. */
export function scheduleToIso(
  startSlot: string | null,
  endSlot: string | null,
  dayKey: string | null,
  now = new Date(),
): { startAt: string | null; endAt: string | null } {
  const base = dayBase(dayKey, now)
  const startAt = startSlot ? slotToIso(startSlot, base) : null
  return { startAt, endAt: endSlot ? endSlotToIso(endSlot, startAt, base) : null }
}
