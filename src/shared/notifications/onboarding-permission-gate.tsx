import { useSegments } from 'expo-router'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { trackingConsent, type TrackingConsent } from '@/shared/consent/tracking'
import { useAppForeground } from '@/shared/hooks/use-app-foreground'
import { useSession } from '@/shared/providers/session-provider'
import { isSplashHidden, subscribeSplashHidden } from '@/shared/ui/splash-state'
import { onboardingPermissionStore, type OnboardingPermissionStore } from './onboarding-permission-store'
import { pushPermission } from './permission-bootstrap'

const ENTRY_SEGMENTS = new Set(['index', 'auth', 'sign-in', 'onboarding'])

/** Only Start creates this intent. Auth and navigation never depend on its answer. */
export function OnboardingPermissionGate({ store = onboardingPermissionStore, consent = trackingConsent, request = () => pushPermission.request() }: {
  store?: OnboardingPermissionStore; consent?: Pick<TrackingConsent, 'settled'>; request?: () => Promise<unknown>
}) {
  const { status } = useSession()
  const segments = useSegments()
  const active = useAppForeground()
  const hidden = useSyncExternalStore(subscribeSplashHidden, isSplashHidden)
  const pending = useSyncExternalStore(store.subscribe, store.snapshot)
  const ready = status === 'user' && active && hidden && segments.length > 0 && !segments.some(segment => ENTRY_SEGMENTS.has(segment))
  const currentReady = useRef(ready)
  useLayoutEffect(() => { currentReady.current = ready }, [ready])

  useEffect(() => { void store.load() }, [store])
  useEffect(() => {
    if (!ready || !pending) return
    let cancelled = false
    void consent.settled().then(async () => {
      // Idle tracking is not settlement. After the explicit contract resolves,
      // recheck the current moment before synchronously claiming and requesting.
      if (cancelled || !currentReady.current) return
      const token = store.claim()
      if (token === undefined) return
      try { await request() } catch { /* An attempted request still consumes intent. */ }
      finally { await store.consume(token) }
    })
    return () => { cancelled = true }
  }, [consent, pending, ready, request, store])
  return null
}
