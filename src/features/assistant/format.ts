/**
 * Times and dates in GoGo AI (GoGo-MobileApp#378), in the device's time zone
 * and the app's language: "21:04" on a message, "21 Oct" on an older history
 * row, "Sat, 31 Oct · 20:00–22:00" on a proposal.
 */
const tag = (locale: string) => (locale === 'en' ? 'en-GB' : 'vi-VN')

const pad = (value: number) => String(value).padStart(2, '0')

export function formatClock(iso: string): string {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatShortDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(tag(locale), { day: 'numeric', month: 'short' })
}

export function formatDay(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(tag(locale), { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Sat, 31 Oct · 20:00–22:00"; without an end, just the start. */
export function formatWhen(startIso: string, endIso: string | null, locale: string): string {
  const start = `${formatDay(startIso, locale)} · ${formatClock(startIso)}`
  return endIso ? `${start}–${formatClock(endIso)}` : start
}
