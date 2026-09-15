import { describe, expect, it } from 'vitest'

import { planStart, planWhen } from '../plan-title'

// Local reference point: 2026-09-15 20:30 on the device clock.
const now = new Date(2026, 8, 15, 20, 30)

describe('planWhen', () => {
  it('calls any time on the same calendar day today, whatever the daypart', () => {
    expect(planWhen(new Date(2026, 8, 15, 0, 5), now)).toEqual({ relative: 'today', day: '15', month: '09', year: '2026', time: '00:05' })
    expect(planWhen(new Date(2026, 8, 15, 23, 59), now).relative).toBe('today')
  })

  it('switches to tomorrow at local midnight, not 24 hours on', () => {
    expect(planWhen(new Date(2026, 8, 16, 0, 1), now)).toEqual({ relative: 'tomorrow', day: '16', month: '09', year: '2026', time: '00:01' })
    expect(planWhen(new Date(2026, 8, 16, 23, 0), now).relative).toBe('tomorrow')
  })

  it('gives any other day in this year its date, past or future', () => {
    expect(planWhen(new Date(2026, 8, 17, 9, 0), now)).toEqual({ relative: 'other', day: '17', month: '09', year: '2026', time: '09:00' })
    expect(planWhen(new Date(2026, 8, 14, 19, 0), now).relative).toBe('other')
  })

  it('names the year for a day outside the current one, past or future', () => {
    expect(planWhen(new Date(2027, 0, 3, 19, 0), now)).toEqual({ relative: 'otherYear', day: '03', month: '01', year: '2027', time: '19:00' })
    expect(planWhen(new Date(2025, 11, 20, 19, 0), now)).toMatchObject({ relative: 'otherYear', year: '2025' })
  })

  it('still says tomorrow across new year', () => {
    const newYearsEve = new Date(2026, 11, 31, 22, 0)
    expect(planWhen(new Date(2027, 0, 1, 10, 0), newYearsEve)).toMatchObject({ relative: 'tomorrow', year: '2027' })
  })
})

describe('planStart', () => {
  const room = { constraints: { startAt: '2026-09-20T12:00:00.000Z' }, scheduledDate: '2026-09-21T12:00:00.000Z' }

  it('takes the earliest stop arrival, whatever order the stops come in', () => {
    const stops = [{ arriveAt: '2026-09-18T13:30:00.000Z' }, { arriveAt: '2026-09-18T12:00:00.000Z' }, {}]
    expect(planStart(stops, room)?.toISOString()).toBe('2026-09-18T12:00:00.000Z')
  })

  it('falls back to the room start, then to its scheduled date', () => {
    expect(planStart([{}], room)?.toISOString()).toBe('2026-09-20T12:00:00.000Z')
    expect(planStart([], { scheduledDate: room.scheduledDate })?.toISOString()).toBe('2026-09-21T12:00:00.000Z')
  })

  it('knows no date when nothing carries one', () => {
    expect(planStart(undefined, undefined)).toBeNull()
    expect(planStart([{ arriveAt: 'not a date' }], { constraints: {} })).toBeNull()
  })
})
