import { useEffect, useState } from 'react'
import { UnistylesRuntime } from 'react-native-unistyles'

import { readAccentPreference } from '@/shared/theme/accent-preference'

/**
 * Applies the saved accent at start-up and reports when it is on screen.
 *
 * Unistyles boots with the default theme (`unistyles.ts`), and the preference
 * is one asynchronous read away. The native splash stays up until this
 * resolves (`AppProviders` hides it on `true`), so a user who chose green
 * never sees an orange frame first. The read never rejects — it resolves to
 * the default on any storage failure — so `ready` always arrives.
 */
export function useAccentBootstrap(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void readAccentPreference().then(accent => {
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
