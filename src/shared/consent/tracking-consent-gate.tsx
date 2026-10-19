import { useSegments } from 'expo-router'
import { useEffect, useReducer, useSyncExternalStore } from 'react'

import { useAppForeground } from '@/shared/hooks/use-app-foreground'
import { useSession } from '@/shared/providers/session-provider'
import { isSplashHidden, subscribeSplashHidden } from '@/shared/ui/splash-state'

import { TrackingSheet } from './tracking-sheet.view'
import { trackingConsent, type TrackingConsent } from './tracking'

/** Not the moment to ask: the person is still getting in. */
const ENTRY_SEGMENTS = new Set(['auth', 'sign-in', 'onboarding'])

type Phase = 'idle' | 'checking' | 'visible' | 'requesting' | 'done'

/**
 * This launch's consent question, in module scope so a remounted layout does
 * not ask twice. `generation` retires a status read whose moment has passed.
 */
const launch: { phase: Phase; generation: number } = { phase: 'idle', generation: 0 }

/** For tests only: a new launch. */
export function resetTrackingConsentLaunch(): void {
  launch.phase = 'idle'
  launch.generation += 1
}

/**
 * GoGo-MobileApp#366 — decides when the tracking sheet appears (shape rev 2
 * D5.3): once per launch, only where ATT exists, only while iOS has no answer,
 * and only at a real moment — the splash lifted, the app in the foreground,
 * someone signed in or joined as a guest, on a screen past sign-in and
 * onboarding. If that moment ends first (a read still pending, or the sheet
 * up when the session ends or the app leaves the foreground), the question is
 * put back and asked at the next one. It is settled only by an answer, "Để
 * sau", or iOS having answered before. Mounted once, in the root layout.
 */
export function TrackingConsentGate({ consent = trackingConsent }: { consent?: TrackingConsent }) {
  const { status } = useSession()
  const segments = useSegments()
  const splashHidden = useSyncExternalStore(subscribeSplashHidden, isSplashHidden)
  const active = useAppForeground()
  // The question's state lives in `launch`; this only re-renders after it moves.
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  const ready =
    splashHidden &&
    active &&
    segments.length > 0 &&
    (status === 'user' || status === 'guest') &&
    !segments.some(segment => ENTRY_SEGMENTS.has(segment))

  useEffect(() => {
    if (!ready) {
      // The moment passed. A pending read is retired; a sheet nobody answered
      // is taken down and asked again later. The system dialog, once up, is
      // left to finish.
      if (launch.phase === 'checking' || launch.phase === 'visible') {
        launch.phase = 'idle'
        launch.generation += 1
      }
      return
    }
    if (launch.phase !== 'idle') return
    launch.phase = 'checking'
    const generation = ++launch.generation
    void consent.status().then(current => {
      if (generation !== launch.generation || launch.phase !== 'checking') return
      if (current === 'undetermined') {
        launch.phase = 'visible'
        refresh()
      } else {
        launch.phase = 'done'
        consent.settle()
      }
    })
  }, [consent, ready])

  const onContinue = () => {
    if (launch.phase !== 'visible') return
    launch.phase = 'requesting'
    refresh()
    void consent.request().finally(() => {
      launch.phase = 'done'
      refresh()
      consent.settle()
    })
  }

  const onLater = () => {
    if (launch.phase !== 'visible') return
    launch.phase = 'done'
    refresh()
    consent.later()
  }

  // Down the moment readiness goes (the effect then puts the question back);
  // the system dialog, once up, stays until iOS answers.
  const requesting = launch.phase === 'requesting'
  const shown = requesting || (launch.phase === 'visible' && ready)

  return <TrackingSheet visible={shown} requesting={requesting} onContinue={onContinue} onLater={onLater} />
}
