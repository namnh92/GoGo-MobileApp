import { expect, it } from 'vitest'

import { formatDay, formatShortDate, formatWhen } from '../format'

/**
 * GoGo-MobileApp#414 — these strings come from the running ICU's CLDR. Measured
 * identical on CLDR 48 (Node 22) and 49 (Node 26), so they stay on Intl and are
 * pinned exactly: the next CLDR that moves one fails here, as #410's comma would have.
 * Instants are built from local parts, so the pins hold in any time zone.
 */
const local = (month: number, day: number, hour = 19, minute = 7) =>
  new Date(2026, month - 1, day, hour, minute).toISOString()

it('pins the short date of every month in both languages', () => {
  const months = Array.from({ length: 12 }, (_, index) => index + 1)
  expect(months.map(month => formatShortDate(local(month, 5), 'vi'))).toEqual(
    months.map(month => `5 thg ${month}`),
  )
  // CLDR's en-GB abbreviates September as "Sept", not "Sep".
  expect(months.map(month => formatShortDate(local(month, 5), 'en'))).toEqual([
    '5 Jan', '5 Feb', '5 Mar', '5 Apr', '5 May', '5 Jun', '5 Jul', '5 Aug', '5 Sept', '5 Oct', '5 Nov', '5 Dec',
  ])
})

it('pins the weekday label of every day in both languages', () => {
  // 1 November 2026 is a Sunday.
  const days = [1, 2, 3, 4, 5, 6, 7]
  expect(days.map(day => formatDay(local(11, day), 'vi'))).toEqual([
    'CN, 1 thg 11', 'Thứ 2, 2 thg 11', 'Thứ 3, 3 thg 11', 'Thứ 4, 4 thg 11',
    'Thứ 5, 5 thg 11', 'Thứ 6, 6 thg 11', 'Thứ 7, 7 thg 11',
  ])
  expect(days.map(day => formatDay(local(11, day), 'en'))).toEqual([
    'Sun 1 Nov', 'Mon 2 Nov', 'Tue 3 Nov', 'Wed 4 Nov', 'Thu 5 Nov', 'Fri 6 Nov', 'Sat 7 Nov',
  ])
})

it('pins the proposal line built on the weekday label', () => {
  expect(formatWhen(local(10, 31, 20, 0), local(10, 31, 22, 0), 'vi')).toBe('Thứ 7, 31 thg 10 · 20:00–22:00')
  expect(formatWhen(local(10, 31, 20, 0), null, 'en')).toBe('Sat 31 Oct · 20:00')
})
