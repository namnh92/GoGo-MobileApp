import { freshDay, localDayKey } from './schedule-day'

/** A `YYYY-MM-DD` key as a local midnight; null for anything that is not a real day. */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return localDayKey(date) === key ? date : null
}

/** The coming Saturday; on a Saturday or a Sunday, that day itself. */
export function weekendDay(now = new Date()): { key: string; date: Date } {
  const dow = now.getDay()
  const ahead = dow === 6 || dow === 0 ? 0 : 6 - dow
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead)
  return { key: localDayKey(date), date }
}

/** A Monday-first month: weeks of seven, `null` where the week belongs to a neighbouring month. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

/**
 * A slot on the chosen day that is already over. Only today has any: the slot
 * helpers would roll such a start to tomorrow, which the screen must never do
 * silently while it still says today, so it refuses the slot instead.
 */
export function isPastSlot(slot: string, dayKey: string | null, now = new Date()): boolean {
  if (freshDay(dayKey, now) !== null) return false
  const match = /^(\d{2}):(\d{2})$/.exec(slot)
  if (!match) return false
  const candidate = new Date(now)
  candidate.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return candidate.getTime() <= now.getTime()
}
