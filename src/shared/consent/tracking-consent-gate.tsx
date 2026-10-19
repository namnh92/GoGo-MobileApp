import { useSegments } from 'expo-router'
import { useEffect, useState } from 'react'

import { useSession } from '@/shared/providers/session-provider'

import { TrackingSheet } from './tracking-sheet.view'
import { trackingConsent, type TrackingConsent } from './tracking'

/** Not the moment to ask: the person is still getting in. */
const ENTRY_SEGMENTS = new Set(['auth', 'sign-in', 'onboarding'])

/** Once per launch, whatever remounts the layout. */
let askedThisLaunch = false

/** For tests only: a new launch. */
export function resetTrackingConsentLaunch(): void {
  askedThisLaunch = false
}

/**
 * GoGo-MobileApp#366 — decides when the tracking sheet appears: once per
 * launch, only where ATT exists, only while iOS has not been answered, and
 * only on the first screen after someone is signed in or joined as a guest —
 * never on the splash, sign-in or onboarding (shape rev 2 D5.3). Whatever
 * happens, the launch's consent question is then settled, so the deferred-link
 * resume that waits on it goes ahead. Mounted once, in the root layout.
 */
export function TrackingConsentGate({ consent = trackingConsent }: { consent?: TrackingConsent }) {
  const { status } = useSession()
  const segments = useSegments()
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const ready =
    segments.length > 0 &&
    (status === 'user' || status === 'guest') &&
    !segments.some(segment => ENTRY_SEGMENTS.has(segment))

  useEffect(() => {
    if (!ready || askedThisLaunch) return
    askedThisLaunch = true
    let cancelled = false
    void consent.status().then(current => {
      if (cancelled) {
        // Left before the status came back: the next ready screen asks.
        askedThisLaunch = false
        return
      }
      if (current === 'undetermined') setVisible(true)
      else consent.settle()
    })
    return () => {
      cancelled = true
    }
  }, [consent, ready])

  const onContinue = () => {
    setRequesting(true)
    void consent.request().finally(() => {
      setRequesting(false)
      setVisible(false)
      consent.settle()
    })
  }

  const onLater = () => {
    if (requesting) return
    setVisible(false)
    consent.later()
  }

  return <TrackingSheet visible={visible} requesting={requesting} onContinue={onContinue} onLater={onLater} />
}
