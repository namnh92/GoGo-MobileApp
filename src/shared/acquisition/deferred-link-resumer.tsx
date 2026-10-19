import { useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { Linking } from 'react-native'

import { openDeepLinkAction } from '@/shared/navigation/open-deep-link'
import { notificationClicks } from '@/shared/notifications/notification-clicks'
import { useSession } from '@/shared/providers/session-provider'

import { deferredLinkSettled, installScoped } from './bootstrap'
import { pendingDeepLinks } from './pending-deep-links'
import { createDeferredLinkResume } from './resume'

/** Diagnostics only, and only in development builds. */
const report = (event: string) => {
  if (__DEV__) console.warn(event)
}

let resume: ReturnType<typeof createDeferredLinkResume> | undefined

/**
 * Who is signed in, as of the last commit. Module scope because the resume it
 * is read by outlives the render that started it and is shared by remounts.
 */
const signedIn: { key: string | null } = { key: null }

/**
 * GoGo-MobileApp#364 — opens a deferred link once the app can: the splash has
 * redirected (same readiness rule as `NotificationClickRouter`) and someone is
 * signed in or joined as a guest. While nobody is, the link waits in the store,
 * so an invite followed before sign-up opens after it. Renders nothing; mounted
 * once, in the root layout.
 */
export function DeferredLinkResumer() {
  const router = useRouter()
  const { status, session } = useSession()
  const segments = useSegments()

  const active = status === 'user' || status === 'guest'
  const ready = segments.length > 0 && active
  const key = active ? `${status}:${session?.userId ?? session?.roomId ?? ''}` : null

  // Declared first so it runs first: a resume started below reads this key.
  useEffect(() => {
    signedIn.key = key
  }, [key])

  useEffect(() => {
    if (!ready) return
    // Module scope: at most one open per process, whatever remounts the layout.
    resume ??= createDeferredLinkResume({
      store: pendingDeepLinks,
      settled: deferredLinkSettled,
      initialUrl: () => Linking.getInitialURL(),
      open: (action) => openDeepLinkAction(router, action, 'deferred'),
      sessionKey: () => signedIn.key,
      launchClaimed: () => notificationClicks.launchClaimed(),
      installScoped,
      report,
    })
    void resume()
  // `key`: a run that stood down for a changed session lets the next one try —
  // and a session asking while a run is in flight is remembered by `resume`.
  }, [ready, router, key])

  return null
}
