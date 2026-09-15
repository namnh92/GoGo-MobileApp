import { useQueryClient } from '@tanstack/react-query'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useEffect } from 'react'

import { useSession } from '@/shared/providers/session-provider'

import { notificationClicks, type NotificationClicks } from './notification-clicks'
import { openNotificationTarget } from './notification-open'

/**
 * The launch route. The splash replaces itself with the tabs once the session
 * settles, so a screen pushed on top of it would be replaced along with it —
 * the cold-start tap would land on Home after all. Its pathname (`/`) is the
 * same as the home tab's, so the route name is what tells them apart.
 */
const LAUNCH_ROUTE = 'index'

/**
 * GoGo-MobileApp#256 — drains tapped notifications once the app can open them:
 * the navigator is mounted, the launch redirect has run, the session has
 * hydrated. Renders nothing; mounted once, in the root layout.
 */
export function NotificationClickRouter({ clicks = notificationClicks }: { clicks?: NotificationClicks }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { status } = useSession()
  const navigation = useRootNavigationState()
  const top = navigation?.routes?.[navigation.index ?? 0]?.name
  const ready = Boolean(navigation?.key) && Boolean(top) && top !== LAUNCH_ROUTE && status !== 'hydrating'

  useEffect(() => {
    if (!ready) return
    clicks.setOpener(target => openNotificationTarget(target, { router, queryClient, status }))
    return () => clicks.setOpener(null)
  }, [clicks, ready, router, queryClient, status])

  return null
}
