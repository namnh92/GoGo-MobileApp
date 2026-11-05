import { describe, expect, it } from 'vitest'

import { dayLabel, monthLabel } from '../day-format'
import { isPastSlot, monthGrid, weekendDay } from '../calendar'

// Fixed local reference point: 2026-08-27 20:00 local.
const now = new Date(2026, 7, 27, 20, 0, 0, 0)

describe('the month calendar (#501)', () => {
  it('weekendDay is the coming Saturday, and today on a Saturday or a Sunday', () => {
    expect(weekendDay(new Date(2026, 10, 5)).key).toBe('2026-11-07') // Thursday
    expect(weekendDay(new Date(2026, 10, 2)).key).toBe('2026-11-07') // Monday
    expect(weekendDay(new Date(2026, 10, 6)).key).toBe('2026-11-07') // Friday
    expect(weekendDay(new Date(2026, 10, 7)).key).toBe('2026-11-07') // Saturday
    expect(weekendDay(new Date(2026, 10, 8)).key).toBe('2026-11-08') // Sunday
  })

  it('monthGrid is Monday-first, whole weeks, one cell per day', () => {
    const weeks = monthGrid(2026, 10) // November 2026 starts on a Sunday
    expect(weeks.every(week => week.length === 7)).toBe(true)
    expect(weeks[0].slice(0, 6).every(cell => cell === null)).toBe(true)
    expect(weeks[0][6]?.getDate()).toBe(1)
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
    expect(monthGrid(2026, 1).flat().filter(Boolean)).toHaveLength(28) // February, 28 days
    expect(monthGrid(2026, 5)[0][0]?.getDate()).toBe(1) // June 2026 starts on a Monday
  })

  it('isPastSlot is only ever true on today', () => {
    // `now` is 20:00 on 27 August.
    expect(isPastSlot('19:00', null, now)).toBe(true)
    expect(isPastSlot('20:00', '2026-08-27', now)).toBe(true)
    expect(isPastSlot('20:30', null, now)).toBe(false)
    expect(isPastSlot('08:00', '2026-08-28', now)).toBe(false)
  })

  it('formats the day from parts', () => {
    expect(dayLabel(new Date(2026, 10, 7), 'vi')).toMatch(/, 07\/11$/)
    expect(dayLabel(new Date(2026, 10, 7), 'en')).toMatch(/, 11\/07$/)
    expect(monthLabel(2026, 10, 'en')).toBe('November, 2026')
  })
})
