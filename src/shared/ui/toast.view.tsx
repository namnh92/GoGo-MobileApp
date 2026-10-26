import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './toast.style'

/** How long a toast stays when the caller does not say (#381: one shared value). */
export const TOAST_DURATION_MS = 2600

/**
 * Fixed toast near the top of the screen — `role=status` equivalent.
 *
 * `accessibilityLiveRegion` is Android-only, so on iOS VoiceOver never read a
 * toast (#381). iOS is told through `announceForAccessibility` whenever the
 * message changes; Android keeps the live region, and announcing there too
 * would read it twice.
 */
export function Toast({ message }: { message: string }) {
  const insets = useSafeAreaInsets()
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message)
  }, [message])
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + spacing[6] }]}
    >
      <Text variant="label" color="text.inverse">{message}</Text>
    </View>
  )
}

export interface ToastOptions {
  /** Milliseconds on screen; defaults to `TOAST_DURATION_MS`. */
  duration?: number
}

interface QueuedToast {
  id: number
  message: string
  duration: number
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/**
 * One toast at a time for the whole app (#381). Screens used to keep their own
 * message state and timer (`date-plan.view`); a second toast then cut the
 * first short. Here they queue: each gets its full duration, in order. The
 * same message queued twice in a row is shown once.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedToast[]>([])
  const nextId = useRef(0)
  const current = queue[0]

  const show = useCallback((message: string, options?: ToastOptions) => {
    setQueue(previous => {
      if (previous.at(-1)?.message === message) return previous
      nextId.current += 1
      return [...previous, { id: nextId.current, message, duration: options?.duration ?? TOAST_DURATION_MS }]
    })
  }, [])

  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => setQueue(previous => previous.slice(1)), current.duration)
    return () => clearTimeout(timer)
  }, [current])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      <View style={styles.host}>
        {children}
        {current ? <Toast key={current.id} message={current.message} /> : null}
      </View>
    </ToastContext.Provider>
  )
}

/** `show(message)` from anywhere under `ToastProvider` (mounted in `AppProviders`). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast() needs a <ToastProvider> above it')
  return api
}
