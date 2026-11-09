import { useNotificationSummary } from '@/shared/api'
import { notificationCapabilities } from './notification-capabilities'
import { useSession } from '@/shared/providers/session-provider'

/** Shared summary drives bell/profile counts; guests never read account data. */
export function useUnreadInbox(): { count: number; more: boolean; refetch: () => Promise<unknown> } {
  const { status } = useSession()
  const summary = useNotificationSummary({ enabled: status === 'user' && notificationCapabilities().summary })
  // A disabled query still returns its cache: after sign-out that is someone else's.
  const refetch = () => status === 'user' ? summary.refetch() : Promise.resolve()
  if (status !== 'user') return { count: 0, more: false, refetch }
  return { count: summary.data?.unreadCount ?? 0, more: false, refetch }
}
