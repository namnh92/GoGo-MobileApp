import type { paths, components } from '@/shared/api/schema'

export const notificationCategories = ['invite', 'preference_reminder', 'plan_ready', 'plan_changed', 'date_reminder'] as const
export type NotificationCategory = typeof notificationCategories[number]

type HasMethod<P extends string, M extends string> = P extends keyof paths
  ? M extends keyof paths[P] ? Exclude<paths[P][M], undefined> extends never ? false : true : false : false
type Settings = components['schemas']['NotificationSettings']
type InboxQuery = NonNullable<paths['/me/notifications']['get']['parameters']['query']>

/** Compile-checked against the generated client. Regeneration deliberately asks
 * us to wire the real typed adapter here before a newly shipped operation opens.
 * No speculative requests, local preference persistence or page-count totals.
 * BE#811 / ADR-0050: see docs/verification/issue-539-group-10.md for unlocks.
 */
export const generatedNotificationCapabilities = {
  summary: true as const satisfies HasMethod<'/me/notifications/summary', 'get'>,
  readAll: true as const satisfies HasMethod<'/me/notifications/read-all', 'post'>,
  categoryPatch: false as const satisfies HasMethod<'/me/notification-settings', 'patch'>,
  categoryFields: false as const satisfies ('categories' extends keyof Settings ? true : false),
  categoryFilter: false as const satisfies ('category' extends keyof InboxQuery ? true : false),
  quietHours: false as const satisfies ('quietHours' extends keyof Settings ? true : false),
}

export function notificationCapabilities(settings?: Settings) {
  return {
    ...generatedNotificationCapabilities,
    // Missing settings never has a meaningful off/on value.
    master: typeof settings?.pushEnabled === 'boolean' && !('categories' in settings),
  }
}
