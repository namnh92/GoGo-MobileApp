/** Local calendar input; never parse a locale-formatted string with Date.parse. */
export function localScheduleToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, day, month, year, hour, minute] = match.map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
    || date.getHours() !== hour || date.getMinutes() !== minute) return null
  return date.toISOString()
}

export function isoToLocalSchedule(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}
const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

function parsed(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function roomScheduleLabel(value: string | undefined, locale: string): string | null {
  return parsed(value)?.toLocaleString(locale, DATE_TIME) ?? null
}

export interface RoomScheduleRange {
  /** When the outing starts: date and time, in the locale's format. */
  start: string
  /**
   * When it ends — the time alone when that is the same local calendar day,
   * the full date and time when it crosses midnight. `null` when the room
   * stores no end, or stores one that is not after the start: an end that
   * cannot be true is left out rather than drawn as a backwards range.
   */
  end: string | null
}

/**
 * GoGo-MobileApp#201 — `constraints.endAt` is part of the room's schedule and
 * was never rendered anywhere, so a room booked 19:00–22:00 read as "19:00".
 *
 * A missing or unparseable `startAt` returns `null`: an end time on its own
 * says nothing about when to turn up, and no date is invented for it.
 */
export function roomScheduleRange(
  startValue: string | undefined,
  endValue: string | undefined,
  locale: string,
): RoomScheduleRange | null {
  const start = parsed(startValue)
  if (!start) return null
  const startLabel = start.toLocaleString(locale, DATE_TIME)
  const end = parsed(endValue)
  if (!end || end.getTime() <= start.getTime()) return { start: startLabel, end: null }
  const sameDay = start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth()
    && start.getDate() === end.getDate()
  return { start: startLabel, end: sameDay ? end.toLocaleTimeString(locale, TIME_ONLY) : end.toLocaleString(locale, DATE_TIME) }
}
