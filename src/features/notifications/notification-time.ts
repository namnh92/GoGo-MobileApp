import type { TFunction } from 'i18next'

/** Hermes need not provide Intl.RelativeTimeFormat. Return facts for i18next. */
export function notificationAge(created: Date, now = Date.now()): { unit: 'now' | 'minute' | 'hour' | 'day'; count: number } {
  const seconds = Math.max(0, (now - created.getTime()) / 1000)
  if (seconds < 60) return { unit: 'now', count: 0 }
  if (seconds < 3600) return { unit: 'minute', count: Math.floor(seconds / 60) }
  if (seconds < 86400) return { unit: 'hour', count: Math.floor(seconds / 3600) }
  return { unit: 'day', count: Math.floor(seconds / 86400) }
}

/** Shared relative copy for personal createdAt and public publishedAt. */
export function formatNotificationTime(created: Date, t: TFunction): string {
  const age = notificationAge(created)
  return t(age.unit === 'day' && age.count === 1 ? 'g10.time.yesterday' : age.unit === 'now' ? 'g10.time.now' : age.unit === 'minute'
    ? 'g10.time.minute' : age.unit === 'hour' ? 'g10.time.hour' : 'g10.time.day', { count: age.count })
}
