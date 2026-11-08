import { describe, expect, it } from 'vitest'
import { notificationAge } from '../notification-time'

describe('notification event age without Intl.RelativeTimeFormat', () => {
  const now = Date.parse('2026-11-08T10:00:00Z')
  it.each([
    [-5, 'now', 0], [0, 'now', 0], [59, 'now', 0], [60, 'minute', 1],
    [3599, 'minute', 59], [3600, 'hour', 1], [86399, 'hour', 23], [86400, 'day', 1], [86400 * 3, 'day', 3],
  ] as const)('%s seconds uses %s with count %s', (seconds, unit, count) => {
    expect(notificationAge(new Date(now - seconds * 1000), now)).toEqual({ unit, count })
  })
})
