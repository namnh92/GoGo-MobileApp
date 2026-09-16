import { useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSegments } from 'expo-router'
import { useEffect, useRef } from 'react'

import { useSession } from '@/shared/providers/session-provider'

import { notificationClicks, type NotificationClicks } from './notification-clicks'
import { openNotificationTarget } from './notification-open'

/** Diagnostics only, and only in development builds. */
const report = (event: string) => {
  if (__DEV__) console.warn(event)
}

/**
 * GoGo-MobileApp#256 — drains tapped notifications once the app can open them:
 * the launch screen has redirected and the session has hydrated. Renders
 * nothing; mounted once, in the root layout.
 *
 * Readiness is read from the route, not from the navigator. Called from the
 * root layout, `useRootNavigationState()` is expo-router's internal `__root`
 * slot, whose only route is always `__root`, so it cannot tell the splash from
 * anything else. The splash (`src/app/index.tsx`) is the one screen with no
 * segments: once it replaces itself with the tabs they read `['(tabs)']`, and
 * every other screen has at least one. Opening a screen while the splash is up
 * would be undone by its `router.replace('/(tabs)')` — the cold-start tap would
 * land on Home after all.
 */
export function NotificationClickRouter({ clicks = notificationClicks }: { clicks?: NotificationClicks }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { status } = useSession()
  const segments = useSegments()
  const pathname = usePathname()
  const path = useRef(pathname)
  useEffect(() => {
    path.current = pathname
  }, [pathname])

  const ready = segments.length > 0 && status !== 'hydrating'

  useEffect(() => {
    if (!ready) return
    clicks.setOpener((target, { queued }) =>
      openNotificationTarget(target, {
        router,
        queryClient,
        status,
        currentPath: () => path.current,
        coldStart: queued,
        report,
      }),
    )
    return () => clicks.setOpener(null)
  }, [clicks, ready, router, queryClient, status])

  return null
}
