/**
 * Day labels built from parts, not from one `toLocaleDateString` pattern: the
 * pattern's separators change with the ICU the runtime ships (Hermes, Android),
 * and "07-11" for "07/11" is not the label the design draws. The words — the
 * weekday and the month — still come from the locale.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const isVi = (locale: string) => locale.startsWith('vi')

/** "07/11" in Vietnamese (day first), "11/07" in English (month first). */
function numericDate(date: Date, locale: string): string {
  const [first, second] = isVi(locale) ? [date.getDate(), date.getMonth() + 1] : [date.getMonth() + 1, date.getDate()]
  return `${pad(first)}/${pad(second)}`
}

/** The weekday's short form in the locale: "T7" in Vietnamese, "Sat" in English. */
export function weekdayShort(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: isVi(locale) ? 'narrow' : 'short' })
}

/** "T7, 07/11". */
export function dayLabel(date: Date, locale: string): string {
  return `${weekdayShort(date, locale)}, ${numericDate(date, locale)}`
}

/** "T7, 07/11 · 19:00". */
export function dayTimeLabel(date: Date, time: string, locale: string): string {
  return `${dayLabel(date, locale)} · ${time}`
}

/** "Tháng 11, 2026" / "November, 2026": the locale's month name, first letter capitalised. */
export function monthLabel(year: number, month: number, locale: string): string {
  const name = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long' })
  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)}, ${year}`
}
