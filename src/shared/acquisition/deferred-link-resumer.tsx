import { useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { Linking } from 'react-native'

import { openDeepLinkAction } from '@/shared/navigation/open-deep-link'
import { useSession } from '@/shared/providers/session-provider'

import { deferredLinkSettled } from './bootstrap'
import { pendingDeepLinks } from './pending-deep-links'
import { createDeferredLinkResume } from './resume'

/** Diagnostics only, and only in development builds. */
const report = (event: string) => {
  if (__DEV__) console.warn(event)
}

let resume: ReturnType<typeof createDeferredLinkResume> | undefined

/**
 * GoGo-MobileApp#364 — opens a deferred link once the app can: the splash has
 * redirected (same readiness rule as `NotificationClickRouter`) and someone is
 * signed in or joined as a guest. While nobody is, the link waits in the store,
 * so an invite followed before sign-up opens after it. Renders nothing; mounted
 * once, in the root layout.
 */
export function DeferredLinkResumer() {
  const router = useRouter()
  const { status } = useSession()
  const segments = useSegments()

  const ready = segments.length > 0 && (status === 'user' || status === 'guest')

  useEffect(() => {
    if (!ready) return
    // Module scope: once per process, whatever remounts the root layout.
    resume ??= createDeferredLinkResume({
      store: pendingDeepLinks,
      settled: deferredLinkSettled,
      initialUrl: () => Linking.getInitialURL(),
      open: (action) => openDeepLinkAction(router, action, 'deferred'),
      report,
    })
    void resume()
  }, [ready, router])

  return null
}
