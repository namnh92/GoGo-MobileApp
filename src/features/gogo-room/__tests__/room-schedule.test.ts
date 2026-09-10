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
