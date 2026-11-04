import { expect, it } from 'vitest'
import { isoToLocalSchedule, localScheduleToIso, roomScheduleLabel, roomScheduleRange } from '../room-schedule'

/**
 * GoGo-MobileApp#201 — `constraints.endAt` was stored, edited and never
 * rendered, so a room booked 19:00–22:00 read as "19:00" everywhere.
 */
function inSaigon<T>(run: () => T): T {
  const previous = process.env.TZ
  process.env.TZ = 'Asia/Ho_Chi_Minh'
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

it('reads the end as a time when the outing stays inside one local day', () => {
  inSaigon(() => {
    const range = roomScheduleRange('2026-09-10T12:00:00Z', '2026-09-10T15:00:00Z', 'vi')
    expect(range?.start).toContain('19:00')
    expect(range?.start).toContain('2026')
    // Same day: the end repeats no date.
    expect(range?.end).toBe('22:00')
  })
})

it('carries the date on the end when the outing crosses midnight', () => {
  inSaigon(() => {
    const range = roomScheduleRange('2026-09-10T15:00:00Z', '2026-09-10T18:00:00Z', 'vi')
    expect(range?.start).toContain('22:00')
    expect(range?.end).toContain('01:00')
    // 11/09 locally, so the day has to be said.
    expect(range?.end).toContain('11')
  })
})

function inZone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ
  process.env.TZ = zone
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
}

/**
 * PR #305 review F-01 — on a DST fallback night 08:30Z–09:15Z in Los Angeles is
 * a real 45-minute outing whose wall clock reads 01:30 PDT → 01:15 PST. A
 * time-only end ("01:30 … – 01:15") reads backwards; both ends must carry
 * their date and zone so the range is unambiguous.
 */
it('never renders a range that reads backwards across a DST fallback', () => {
  inZone('America/Los_Angeles', () => {
    const range = roomScheduleRange('2026-11-01T08:30:00Z', '2026-11-01T09:15:00Z', 'en')
    expect(range?.end).not.toBeNull()
    expect(range?.end).toContain('2026')
    expect(range?.end).toContain('01:15')
    expect(range?.end).toContain('PST')
    expect(range?.start).toContain('01:30')
    expect(range?.start).toContain('PDT')
  })
})

it('keeps the plain format, without zone names, when no clock change sits in the range', () => {
  inZone('America/Los_Angeles', () => {
    const range = roomScheduleRange('2026-11-01T17:00:00Z', '2026-11-01T19:00:00Z', 'en')
    expect(range?.start).not.toMatch(/P[DS]T/)
    expect(range?.end).toBe(new Date('2026-11-01T19:00:00Z').toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }))
  })
})

it('leaves out an end that is missing or not after the start', () => {
  expect(roomScheduleRange('2026-09-10T12:00:00Z', undefined, 'vi')?.end).toBeNull()
  expect(roomScheduleRange('2026-09-10T12:00:00Z', 'bad', 'vi')?.end).toBeNull()
  expect(roomScheduleRange('2026-09-10T12:00:00Z', '2026-09-10T12:00:00Z', 'vi')?.end).toBeNull()
  expect(roomScheduleRange('2026-09-10T12:00:00Z', '2026-09-10T11:00:00Z', 'vi')?.end).toBeNull()
})

it('invents no date for a room with no start, even when an end is stored', () => {
  expect(roomScheduleRange(undefined, '2026-09-10T15:00:00Z', 'vi')).toBeNull()
  expect(roomScheduleRange('bad', '2026-09-10T15:00:00Z', 'vi')).toBeNull()
})

it('round trips local dates and times through UTC without changing the calendar selection', () => {
  for (const input of ['10/09/2026 19:00', '29/02/2028 00:30', '01/01/2027 23:59']) {
    expect(isoToLocalSchedule(localScheduleToIso(input)!)).toBe(input)
  }
})
it('rejects impossible dates and times instead of normalizing them silently', () => {
  for (const input of ['29/02/2027 19:00', '31/04/2026 12:00', '01/13/2026 12:00', '10/09/2026 24:01', '10/09/2026 19:60', 'bad']) {
    expect(localScheduleToIso(input)).toBeNull()
  }
})
it('does not invent a date for missing or invalid data', () => {
  expect(roomScheduleLabel(undefined, 'vi')).toBeNull()
  expect(roomScheduleLabel('bad', 'vi')).toBeNull()
  expect(roomScheduleLabel('2026-09-10T12:00:00Z', 'vi')).toContain('2026')
})

it('shows 12:00Z as 19:00 in Asia/Ho_Chi_Minh and sends 19:00 back as the same instant', () => {
  const previous = process.env.TZ
  process.env.TZ = 'Asia/Ho_Chi_Minh'
  try {
    expect(isoToLocalSchedule('2026-09-10T12:00:00Z')).toBe('10/09/2026 19:00')
    expect(localScheduleToIso('10/09/2026 19:00')).toBe('2026-09-10T12:00:00.000Z')
    // Crossing midnight moves the calendar day in local time, never in UTC.
    expect(isoToLocalSchedule('2026-09-10T17:30:00Z')).toBe('11/09/2026 00:30')
    expect(localScheduleToIso('11/09/2026 00:30')).toBe('2026-09-10T17:30:00.000Z')
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})

/**
 * GoGo-MobileApp#414 — `DATE_TIME` and `TIME_ONLY` come from the running ICU's
 * CLDR. Measured identical on CLDR 48 (Node 22) and 49 (Node 26), so they are
 * pinned exactly. Instants are built from local parts: the pins hold in any zone.
 */
const localIso = (hour: number, minute = 5, day = 10) => new Date(2026, 8, day, hour, minute).toISOString()

it('pins the date and time label in both languages, around the 12-hour edges', () => {
  expect(roomScheduleLabel(localIso(19), 'vi')).toBe('19:05 10/09/2026')
  expect(roomScheduleLabel(localIso(0), 'vi')).toBe('00:05 10/09/2026')
  expect(roomScheduleLabel(localIso(19), 'en')).toBe('09/10/2026, 07:05 PM')
  expect(roomScheduleLabel(localIso(0), 'en')).toBe('09/10/2026, 12:05 AM')
  expect(roomScheduleLabel(localIso(12), 'en')).toBe('09/10/2026, 12:05 PM')
})

it('pins the time-only end of a same-day range in both languages', () => {
  expect(roomScheduleRange(localIso(9), localIso(19), 'vi')).toEqual({ start: '09:05 10/09/2026', end: '19:05' })
  expect(roomScheduleRange(localIso(9), localIso(19), 'en')).toEqual({ start: '09/10/2026, 09:05 AM', end: '07:05 PM' })
})

it('pins the full end of a range that crosses midnight in both languages', () => {
  expect(roomScheduleRange(localIso(23), localIso(1, 5, 11), 'vi')?.end).toBe('01:05 11/09/2026')
  expect(roomScheduleRange(localIso(23), localIso(1, 5, 11), 'en')?.end).toBe('09/11/2026, 01:05 AM')
})

/**
 * GoGo-MobileApp#414 — the zone name is the one part measured to differ between
 * CLDR 48 and 49, and the owner accepted that on 2026-11-04. So the date and time
 * around it stay exact, and only the name may read either way.
 */
it('pins the date and time of a range across a clock change, allowing both zone spellings', () => {
  inZone('America/Los_Angeles', () => {
    const vi = roomScheduleRange('2026-11-01T08:30:00Z', '2026-11-01T09:15:00Z', 'vi')
    expect(vi?.start).toMatch(/^01:30 (PDT|GMT-7) 01\/11\/2026$/)
    expect(vi?.end).toMatch(/^01:15 (PST|GMT-8) 01\/11\/2026$/)
    const en = roomScheduleRange('2026-11-01T08:30:00Z', '2026-11-01T09:15:00Z', 'en')
    expect(en).toEqual({ start: '11/01/2026, 01:30 AM PDT', end: '11/01/2026, 01:15 AM PST' })
  })
  inZone('Europe/London', () => {
    const en = roomScheduleRange('2026-10-25T00:30:00Z', '2026-10-25T01:15:00Z', 'en')
    expect(en?.start).toBe('10/25/2026, 01:30 AM GMT+1')
    expect(en?.end).toMatch(/^10\/25\/2026, 01:15 AM GMT(\+0)?$/)
  })
})
