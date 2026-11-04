import { useEffect, useState } from 'react'
import { Appearance } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'

import { readAccentPreference } from '@/shared/theme/accent-preference'
import { DEFAULT_ACCENT, accentOf, modeOf, themeName, type Accent } from '@/shared/ui/theme'

/** The theme for an accent under the device's current appearance. */
export function deviceThemeName(accent: Accent) {
  return themeName(accent, modeOf(Appearance.getColorScheme()))
}

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
 * Applies the saved accent, in the device's appearance, at start-up, follows the device from then on, and reports when it is on screen.
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
    let subscription: ReturnType<typeof Appearance.addChangeListener> | undefined
    void withDeadline(readAccentPreference()).then(accent => {
      if (cancelled) return
      const apply = () => {
        // The accent is whatever the runtime holds now: the user may have
        // picked another since start-up, and the device flipping to dark must
        // keep that pick.
        const current = accentOf(UnistylesRuntime.themeName) ?? accent
        const next = deviceThemeName(current)
        if (UnistylesRuntime.themeName !== next) UnistylesRuntime.setTheme(next)
      }
      apply()
      // No in-app switch: the device setting is the only source of the mode.
      subscription = Appearance.addChangeListener(apply)
      setReady(true)
    })
    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [])

  return ready
}
