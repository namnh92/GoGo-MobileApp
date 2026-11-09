import { parseApiDate, type Notification } from '@/shared/api'

type Payload = NonNullable<Notification['payload']>
type SourcedText = NonNullable<Payload['planPreview']>['stops'][number]['name']

/** Only the BFF's independently evidenced GoGo snapshots are display facts. */
export function notificationText(fact: SourcedText): string | null {
  return fact?.sourceType === 'gogo' && ['editorial', 'community', 'provider'].includes(fact.originType)
    && parseApiDate(fact.verifiedAt) && typeof fact.value === 'string' && fact.value.trim() ? fact.value : null
}

export function notificationCountdown(startsAt: Date, now = Date.now()) {
  const remaining = startsAt.getTime() - now
  if (remaining <= 0) return { key: 'g10.appointmentStarted', count: 0 } as const
  if (remaining < 3600000) return { key: 'g10.remainingMinutes', count: Math.ceil(remaining / 60000) } as const
  return { key: 'g10.remainingHours', count: Math.ceil(remaining / 3600000) } as const
}

/** A current member URL must identify the exact processed GoGo reference. */
export function inviterMediaUrl(url: string | null | undefined, mediaKey: string): string | null {
  if (!/^avatars\/[a-f0-9]{32}\.webp$/.test(mediaKey) || !url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && parsed.pathname.endsWith(`/${mediaKey}`) ? url : null
  } catch { return null }
}
