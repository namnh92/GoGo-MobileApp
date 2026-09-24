import { useEffect, useState } from 'react'
import { UnistylesRuntime } from 'react-native-unistyles'

import { readAccentPreference } from '@/shared/theme/accent-preference'
import { DEFAULT_ACCENT, type Accent } from '@/shared/ui/theme'

/**
 * How long the splash may wait on the preference read. A colour is not worth
 * a hung launch: AsyncStorage on a device with a damaged database can settle
 * late or never, and the splash is held on exactly this promise. Past the
 * deadline the app starts in the default accent, which is what a user with no
 * saved choice gets anyway.
 */
export const ACCENT_READ_DEADLINE_MS = 1500

function withDeadline(read: Promise<Accent>): Promise<Accent> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<Accent>(resolve => {
    timer = setTimeout(() => resolve(DEFAULT_ACCENT), ACCENT_READ_DEADLINE_MS)
  })
  return Promise.race([read, deadline]).finally(() => clearTimeout(timer))
}

/**
 * Applies the saved accent at start-up and reports when it is on screen.
 *
 * Unistyles boots with the default theme (`unistyles.ts`), and the preference
 * is one asynchronous read away. The native splash stays up until this
 * resolves (`AppProviders` hides it on `true`), so a user who chose green
 * never sees an orange frame first. The read never rejects — it resolves to
 * the default on any storage failure — and never outlives the deadline, so
 * `ready` always arrives.
 */
export function useAccentBootstrap(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void withDeadline(readAccentPreference()).then(accent => {
      if (cancelled) return
      if (UnistylesRuntime.themeName !== accent) UnistylesRuntime.setTheme(accent)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
