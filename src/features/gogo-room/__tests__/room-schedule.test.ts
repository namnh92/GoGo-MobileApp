import { expect, it } from 'vitest'
import { isoToLocalSchedule, localScheduleToIso, roomScheduleLabel } from '../room-schedule'

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
