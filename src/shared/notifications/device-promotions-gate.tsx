import { useSegments } from 'expo-router'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { isTrackingQuestionOpen, subscribeTrackingQuestion } from '@/shared/consent/tracking-consent-gate'
import { useAppForeground } from '@/shared/hooks/use-app-foreground'
import { useSession } from '@/shared/providers/session-provider'
import { haptic } from '@/shared/ui/feedback'
import { isSplashHidden, subscribeSplashHidden } from '@/shared/ui/splash-state'

import { DevicePromotionsSheet } from './device-promotions-sheet.view'
import { devicePromotionsStore, type DevicePromotionsStore } from './device-promotions-store'
import { pushIdentity } from './identity-bootstrap'
import { pushPermission } from './permission-bootstrap'

/** Not the moment to ask: the person is still getting in. */
const ENTRY_SEGMENTS = new Set(['auth', 'sign-in', 'onboarding'])

/** "Để sau" lasts this launch, so a remounted layout does not ask twice. */
const launch = { later: false }

/** For tests only: a new launch. */
export function resetDevicePromotionsLaunch(): void {
  launch.later = false
}

export type DevicePromotionsActions = {
  /** Shows the OS prompt when it can still be shown, and says nothing about the answer. */
  requestPermission: () => Promise<unknown>
  /** Starts the write to this gate's store synchronously; resolves after identity convergence. */
  answer: (answer: 'accepted' | 'declined') => Promise<void>
}

const defaultActions: DevicePromotionsActions = {
  requestPermission: () => pushPermission.request(),
  answer: answer => pushIdentity.answerDisclosure(answer),
}

/**
 * GoGo-MobileApp#398 (shape D6) — the disclosure of a device with no account, once
 * per disclosure version, also when the OS permission is already granted. It gates
 * the identity itself: with no answer on record the coordinator creates nothing and
 * restores nothing. Back or a tap outside answers nothing, and it asks next launch.
 * Mounted once, in the root layout.
 */
export function DevicePromotionsGate({
  store = devicePromotionsStore,
  actions = defaultActions,
}: {
  store?: DevicePromotionsStore
  actions?: DevicePromotionsActions
}) {
  const { status } = useSession()
  const segments = useSegments()
  const splashHidden = useSyncExternalStore(subscribeSplashHidden, isSplashHidden)
  const active = useAppForeground()
  const promotions = useSyncExternalStore(store.subscribe, store.snapshot)
  const trackingOpen = useSyncExternalStore(subscribeTrackingQuestion, isTrackingQuestionOpen)
  const [requesting, setRequesting] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [, setLater] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    void store.load()
  }, [store])

  const ready =
    splashHidden &&
    active &&
    !trackingOpen &&
    segments.length > 0 &&
    (status === 'anonymous' || status === 'guest') &&
    !segments.some(segment => ENTRY_SEGMENTS.has(segment))

  const onContinue = () => {
    if (requesting || answered) return
    setRequesting(true)
    void actions
      .requestPermission()
      .catch(() => undefined)
      .then(async () => {
        if (!mounted.current) return
        // The coordinator starts the write now. Wait for durable storage only;
        // identity convergence already reports failures and continues in the background.
        void actions.answer('accepted').catch(() => undefined)
        const saved = await store.saved()
        if (!mounted.current) return
        setSaveFailed(!saved)
        setAnswered(saved)
        setRequesting(false)
        if (saved) haptic('select')
      })
  }

  const onDecline = () => {
    void actions.answer('declined')
    haptic('select')
  }

  const onLater = () => {
    launch.later = true
    setLater(true)
  }

  // The optimistic store snapshot can say "loaded" before its write succeeds.
  const shown = requesting || (ready && (promotions.read === 'absent' || saveFailed) && !launch.later && !answered)

  return (
    <DevicePromotionsSheet
      visible={shown}
      requesting={requesting}
      onContinue={onContinue}
      onDecline={onDecline}
      onLater={onLater}
    />
  )
}
