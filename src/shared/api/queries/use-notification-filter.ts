import { useEffect, useMemo } from 'react'
import type { Notification, NotificationKind } from '../types'
import type { useNotifications } from './use-me'

export type InboxCategory = 'all' | 'invite' | 'plan' | 'date' | 'system'
export function notificationCategory(kind: string | undefined): Exclude<InboxCategory, 'all'> {
  switch (kind) {
    case 'invite': return 'invite'
    case 'plan_ready': case 'plan_changed': case 'preference_reminder': return 'plan'
    case 'date_reminder': return 'date'
    default: return 'system'
  }
}

export const inboxKinds: Record<InboxCategory, readonly NotificationKind[] | undefined> = {
  all: undefined,
  invite: ['invite'],
  plan: ['plan_ready', 'plan_changed', 'preference_reminder'],
  date: ['date_reminder'],
  system: ['campaign', 'moderation_update', 'privacy_export_ready'],
}

export function useNotificationFilter(inbox: ReturnType<typeof useNotifications>, category: InboxCategory, enabled: boolean) {
  const clientFilter = inbox.data?.pages[0]?.clientFilter === true
  const items = useMemo(() => {
    const loaded: Notification[] = (inbox.data?.pages ?? []).flatMap(page => page.notifications ?? [])
    return category === 'all' || !clientFilter ? loaded : loaded.filter(item => notificationCategory(item.kind) === category)
  }, [inbox.data, category, clientFilter])
  const { hasNextPage, isFetching, isError, isPaused, fetchNextPage } = inbox
  const filling = enabled && clientFilter && category !== 'all' && items.length < 10 && !!hasNextPage && !isError && !isPaused
  useEffect(() => {
    if (filling && !isFetching) void fetchNextPage({ cancelRefetch: false }).catch(() => undefined)
  }, [filling, isFetching, fetchNextPage, inbox.data])
  return { items, filling }
}
