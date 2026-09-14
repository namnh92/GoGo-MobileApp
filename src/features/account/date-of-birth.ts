/**
 * PROF-APP-006 (#217) — a date of birth is a calendar date, not an instant.
 * It travels as `YYYY-MM-DD`, is typed as day/month/year like every other date
 * in the app, and is never handed to `new Date(iso)`: that parses as UTC
 * midnight, and a formatter west of UTC then shows the day before.
 */
export type CalendarDate = { year: number; month: number; day: number }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const TYPED = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** A UTC instant at the start of the date — only for arithmetic and UTC formatting. */
function utcInstant({ year, month, day }: CalendarDate): Date {
  const probe = new Date(0)
  // setUTCFullYear, not Date.UTC: Date.UTC maps years 0–99 onto 1900–1999.
  probe.setUTCFullYear(year, month - 1, day)
  return probe
}

function exists(date: CalendarDate): boolean {
  if (date.year < 1 || date.month < 1 || date.month > 12 || date.day < 1) return false
  const probe = utcInstant(date)
  return (
    probe.getUTCFullYear() === date.year && probe.getUTCMonth() === date.month - 1 && probe.getUTCDate() === date.day
  )
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0')

export function toIsoDate({ year, month, day }: CalendarDate): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** `1990-05-17` → its parts, or null for anything that is not a real date. */
export function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  const match = ISO.exec(value ?? '')
  if (!match) return null
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return exists(date) ? date : null
}

/** `1990-05-17` → `17/05/1990`, the shape the field is typed in; '' when unset. */
export function isoToTyped(value: string | null | undefined): string {
  const date = parseIsoDate(value)
  return date ? `${pad(date.day)}/${pad(date.month)}/${pad(date.year, 4)}` : ''
}

/** `17/5/1990` → `1990-05-17`, or null when the typed date does not exist. */
export function typedToIso(text: string): string | null {
  const match = TYPED.exec(text.trim())
  if (!match) return null
  const date = { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) }
  return exists(date) ? toIsoDate(date) : null
}

/**
 * Today in Asia/Ho_Chi_Minh, the calendar the server judges "future" in. That
 * zone is UTC+7 all year with no daylight saving, so a fixed offset is exact
 * and does not depend on the time-zone data a JS engine happens to ship.
 */
export function todayInVietnam(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return toIsoDate({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() })
}

export type DateOfBirthCheck = { ok: true; iso: string } | { ok: false; reason: 'invalid' | 'future' }

/** The same two rules the server applies: the date exists, and it is not after today there. */
export function checkTypedDateOfBirth(text: string, now: Date = new Date()): DateOfBirthCheck {
  const iso = typedToIso(text)
  if (!iso) return { ok: false, reason: 'invalid' }
  // Zero-padded YYYY-MM-DD on both sides, so text order is calendar order.
  if (iso > todayInVietnam(now)) return { ok: false, reason: 'future' }
  return { ok: true, iso }
}

/**
 * `17 tháng 5, 1990` / `May 17, 1990`. The formatter reads the date's own
 * parts in UTC, so no device time zone can move it by a day.
 */
export function formatDateOfBirth(value: string | null | undefined, locale: string): string | null {
  const date = parseIsoDate(value)
  if (!date) return null
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      utcInstant(date),
    )
  } catch {
    return isoToTyped(value)
  }
}
