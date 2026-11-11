import { describe, expect, it } from 'vitest'

import { endSlotToIso, slotToIso } from '../schedule'
import { dayBase, freshDay, scheduleToIso, upcomingDays } from '../schedule-day'

// Fixed local reference point: 2026-08-27 20:00 local.
const now = new Date(2026, 7, 27, 20, 0, 0, 0)

describe('the chosen day (#501)', () => {
  const day = (iso: string | null) => new Date(iso as string)

  it('offers today first and the next three days, keyed in local time', () => {
    expect(upcomingDays(now).map(d => d.key)).toEqual(['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'])
  })

  it('no day and today give exactly what the slot helpers always did', () => {
    const plain = { startAt: slotToIso('21:30', now), endAt: endSlotToIso('23:00', slotToIso('21:30', now), now) }
    expect(scheduleToIso('21:30', '23:00', null, now)).toEqual(plain)
    expect(scheduleToIso('21:30', '23:00', '2026-08-27', now)).toEqual(plain)
  })

  it('a start already past today still resolves to tomorrow, as before', () => {
    expect(day(scheduleToIso('09:00', null, null, now).startAt).getDate()).toBe(28)
  })

  it.each(['2026-08-27', '2026-08-28'])('keeps explicit midnight on %s (#594 F-04)', key => {
    const [year, month, date] = key.split('-').map(Number)
    expect(scheduleToIso('00:00', '02:00', key, now)).toEqual({
      startAt: new Date(year, month - 1, date, 0).toISOString(),
      endAt: new Date(year, month - 1, date, 2).toISOString(),
    })
  })

  it('keeps an explicit past slot on its selected date for caller validation (#594 F-04)', () => {
    expect(scheduleToIso('09:00', '10:00', '2026-08-27', now)).toEqual({
      startAt: new Date(2026, 7, 27, 9).toISOString(),
      endAt: new Date(2026, 7, 27, 10).toISOString(),
    })
  })

  it.each(['00:00', '01:00', '23:00'])('rolls only the end %s at/before an explicit start (#594 F-04)', end => {
    expect(scheduleToIso('23:00', end, '2026-08-28', now)).toEqual({
      startAt: new Date(2026, 7, 28, 23).toISOString(),
      endAt: new Date(2026, 7, 29, Number(end.slice(0, 2))).toISOString(),
    })
  })

  it('tomorrow puts the start on tomorrow, even for a slot earlier than now', () => {
    const { startAt } = scheduleToIso('09:00', null, '2026-08-28', now)
    expect(day(startAt).getDate()).toBe(28)
    expect(day(startAt).getHours()).toBe(9)
  })

  it('an end at or before the start rolls past midnight on a chosen day', () => {
    const { startAt, endAt } = scheduleToIso('22:00', '01:00', '2026-08-29', now)
    expect(day(startAt).getDate()).toBe(29)
    expect(day(endAt).getDate()).toBe(30)
    expect(day(endAt).getHours()).toBe(1)
    expect(day(scheduleToIso('22:00', '22:00', '2026-08-29', now).endAt).getDate()).toBe(30)
  })

  it('a day that has passed or is malformed is today', () => {
    expect(dayBase('2026-08-20', now)).toBe(now)
    expect(dayBase('not-a-day', now)).toBe(now)
    expect(freshDay('2026-08-20', now)).toBeNull()
    expect(freshDay('2026-08-27', now)).toBeNull()
    expect(freshDay('2026-08-28', now)).toBe('2026-08-28')
  })
})
