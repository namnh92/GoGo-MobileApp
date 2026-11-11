import { z } from 'zod'
import { api } from './client'
import { isApiError } from './errors'

// GoGo-BE#815 compatibility adapter. Regenerate the client when 7.8.0 lands,
// then replace this narrow fetch/schema with the generated endpoint/types.
export const systemNotificationSchema = z.object({
  id: z.string().uuid(), kind: z.string(), title: z.string(), body: z.string(),
  deepLink: z.string().nullable(), publishedAt: z.iso.datetime(), expiresAt: z.iso.datetime().nullable(),
})
export const systemNotificationsPageSchema = z.object({
  items: z.array(systemNotificationSchema), nextCursor: z.string().nullable(),
})
export type SystemNotification = z.infer<typeof systemNotificationSchema>

/** A 404 is the capability check on older deployments; other failures stay errors. */
export async function listSystemNotifications(cursor?: string, signal?: AbortSignal) {
  try {
    const response = await api.get<unknown>('/system-notifications', { anonymous: true, query: { cursor, limit: 10 }, signal })
    return { status: 'supported', ...systemNotificationsPageSchema.parse(response) } as const
  } catch (error) {
    if (isApiError(error) && error.status === 404) return { status: 'unsupported', items: [], nextCursor: null } as const
    throw error
  }
}
