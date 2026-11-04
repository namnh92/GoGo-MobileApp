import { useSegments } from 'expo-router'
import { useEffect, useReducer, useSyncExternalStore } from 'react'

import { useAppForeground } from '@/shared/hooks/use-app-foreground'
import { useSession } from '@/shared/providers/session-provider'
import { isSplashHidden, subscribeSplashHidden } from '@/shared/ui/splash-state'

import { TrackingSheet } from './tracking-sheet.view'
import type { ConsentAnswer } from './consent-store'
import { trackingConsent, type TrackingConsent } from './tracking'

/** Not the moment to ask: the person is still getting in. */
const ENTRY_SEGMENTS = new Set(['auth', 'sign-in', 'onboarding'])

type Phase = 'idle' | 'checking' | 'visible' | 'requesting' | 'done'

/**
 * This launch's consent question, in module scope so a remounted layout does
 * not ask twice. `generation` retires a status read whose moment has passed.
 */
const launch: { phase: Phase; generation: number } = { phase: 'idle', generation: 0 }

const phaseListeners = new Set<() => void>()

function setPhase(phase: Phase): void {
  launch.phase = phase
  for (const listener of phaseListeners) listener()
}

/** #398: only one sheet at a time, and iOS drops a second modal without a word. */
export function isTrackingQuestionOpen(): boolean {
  return launch.phase === 'checking' || launch.phase === 'visible' || launch.phase === 'requesting'
}

export function subscribeTrackingQuestion(listener: () => void): () => void {
  phaseListeners.add(listener)
  return () => {
    phaseListeners.delete(listener)
  }
}

/** For tests only: a new launch. */
export function resetTrackingConsentLaunch(): void {
  setPhase('idle')
  launch.generation += 1
}

/**
 * GoGo-MobileApp#366 — decides when the tracking sheet appears (shape rev 2
 * D5.3): once per launch, only where there is a question to ask (#370: Android
 * too, where this sheet is the consent), only while it has no answer,
 * and only at a real moment — the splash lifted, the app in the foreground,
 * someone signed in or joined as a guest, on a screen past sign-in and
 * onboarding. If that moment ends first (a read still pending, or the sheet
 * up when the session ends or the app leaves the foreground), the question is
 * put back and asked at the next one. It is settled only by an answer, "Để
 * sau", or an answer given before. Mounted once, in the root layout.
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
        setPhase('idle')
        launch.generation += 1
      }
      return
    }
    if (launch.phase !== 'idle') return
    setPhase('checking')
    const generation = ++launch.generation
    void consent.status().then(current => {
      if (generation !== launch.generation || launch.phase !== 'checking') return
      if (current === 'undetermined') {
        setPhase('visible')
        refresh()
      } else {
        setPhase('done')
        consent.settle()
      }
    })
  }, [consent, ready])

  const onContinue = () => {
    if (launch.phase !== 'visible') return
    setPhase('requesting')
    refresh()
    void consent.request().finally(() => {
      setPhase('done')
      refresh()
      consent.settle()
    })
  }

  /** Android: no system dialog, so the tap is the answer. */
  const onAnswer = (answer: ConsentAnswer) => {
    if (launch.phase !== 'visible') return
    setPhase('done')
    refresh()
    consent.answer(answer)
  }

  const onLater = () => {
    if (launch.phase !== 'visible') return
    setPhase('done')
    refresh()
    consent.later()
  }

  // Down the moment readiness goes (the effect then puts the question back);
  // the system dialog, once up, stays until iOS answers.
  const requesting = launch.phase === 'requesting'
  const shown = requesting || (launch.phase === 'visible' && ready)

  if (consent.asks === 'app') {
    return (
      <TrackingSheet
        variant="app"
        visible={shown}
        onAllow={() => onAnswer('granted')}
        onDeny={() => onAnswer('denied')}
        onLater={onLater}
      />
    )
  }
  return <TrackingSheet variant="system" visible={shown} requesting={requesting} onContinue={onContinue} onLater={onLater} />
}
