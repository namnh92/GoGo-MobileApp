import { useCallback, useState } from 'react'
import { Alert, type AlertButton, type AlertOptions } from 'react-native'

import { appActivity, type AppActivity } from '@/shared/api/realtime/app-activity'

/**
 * GoGo-MobileApp#198 — a screen that moves people on by itself (the lobby, once
 * the room's run or plan lands) must not do it while they are mid-action on it:
 * a share sheet, a confirmation. Anything that opens one takes a hold.
 */
export type ReleaseHold = () => void

export interface RoutingHold {
  /** True while any hold is taken. */
  held: boolean
  /** Takes a hold; the returned release works once, however often it is called. */
  hold: () => ReleaseHold
}

/** Holds nest: a sheet opened over a confirmation keeps the hold until both close. */
export function useRoutingHold(): RoutingHold {
  const [count, setCount] = useState(0)
  const hold = useCallback((): ReleaseHold => {
    let released = false
    setCount(n => n + 1)
    return () => {
      if (released) return
      released = true
      setCount(n => Math.max(0, n - 1))
    }
  }, [])
  return { held: count > 0, hold }
}

/** `Alert.alert`, holding until one of its buttons or a dismissal settles it. */
export function alertWithHold(
  hold: RoutingHold['hold'],
  title: string,
  message: string | undefined,
  buttons: AlertButton[],
  options?: AlertOptions,
): void {
  const release = hold()
  Alert.alert(
    title,
    message,
    buttons.map(button => ({
      ...button,
      // React Native types `onPress` as a union of two callbacks (plain and
      // login/password prompts); whichever this button carries gets what it was given.
      onPress: (...args: unknown[]) => {
        release()
        ;(button.onPress as ((...pressArgs: unknown[]) => void) | undefined)?.(...args)
      },
    })),
    {
      ...options,
      onDismiss: () => {
        release()
        options?.onDismiss?.()
      },
    },
  )
}

/**
 * Releases once the person is back in the app. Android's share module resolves
 * as soon as the chooser starts, not when it closes (iOS resolves on close), so
 * there the hold waits for the app to leave the foreground and return. When it
 * never leaves — the chooser did not open — a short grace releases it.
 */
export function releaseOnReturn(
  release: ReleaseHold,
  { activity = appActivity, graceMs = 1_000 }: { activity?: AppActivity; graceMs?: number } = {},
): void {
  let left = !activity.isActive()
  let done = false
  let unsubscribe: () => void = () => undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = () => {
    if (done) return
    done = true
    if (timer) clearTimeout(timer)
    unsubscribe()
    release()
  }
  unsubscribe = activity.subscribe(active => {
    if (!active) left = true
    else if (left) finish()
  })
  timer = setTimeout(() => {
    if (!left) finish()
  }, graceMs)
}
