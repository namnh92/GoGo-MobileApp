import { useNotifications } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'

/**
 * Unread count for the bell and the inbox row. The API has no count, so this
 * reads the inbox's first page: `more` means there may be others beyond it, and
 * the badge says `+` instead of claiming a total it does not have.
 * Guests get 403 USER_ONLY on the inbox, so it is not asked for them.
 */
export function useUnreadInbox(): { count: number; more: boolean } {
  const { status } = useSession()
  const inbox = useNotifications({ enabled: status === 'user' })
  const first = inbox.data?.pages[0]
  const count = first?.notifications?.filter(item => !item.readAt).length ?? 0
  return { count, more: count > 0 && !!first?.nextCursor }
}
