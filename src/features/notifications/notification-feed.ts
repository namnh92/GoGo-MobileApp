import { parseApiDate, type Notification } from '@/shared/api'
import type { SystemNotification } from '@/shared/api/system-notifications'

export type NotificationFeedRow =
  | { source: 'personal'; item: Notification }
  | { source: 'system'; item: SystemNotification }

const time = (date: string | null | undefined) => parseApiDate(date)?.getTime() ?? 0

/** Keep the public tail behind the loaded personal cursor so later pages stay chronological. */
export function mergeNotificationFeed(personal: Notification[], system: SystemNotification[], hasNextPersonalPage: boolean): NotificationFeedRow[] {
  const oldestPersonal = personal.reduce((oldest, item) => Math.min(oldest, time(item.createdAt)), Infinity)
  const rows: NotificationFeedRow[] = [
    ...personal.map(item => ({ source: 'personal' as const, item })),
    ...system.filter(item => !hasNextPersonalPage || time(item.publishedAt) >= oldestPersonal)
      .map(item => ({ source: 'system' as const, item })),
  ]
  return rows.sort((a, b) => time(b.source === 'system' ? b.item.publishedAt : b.item.createdAt)
    - time(a.source === 'system' ? a.item.publishedAt : a.item.createdAt))
}
