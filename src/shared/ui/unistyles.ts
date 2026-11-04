import { Appearance } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { DEFAULT_ACCENT, modeOf, themeName, themes } from '@/shared/ui/theme'

/**
 * Unistyles registration (ADR-0009). Imported from the app entry (`index.ts`)
 * right after `expo-router/entry`, so it runs before any route module — and
 * therefore before any `StyleSheet.create` — is evaluated. Jest loads it from
 * `setupFiles`, after `react-native-unistyles/mocks`.
 *
 * `initialTheme` is the default accent in the device's current appearance, not
 * the saved accent: the preference is in AsyncStorage, which is asynchronous,
 * so `AppProviders` reads it and calls `UnistylesRuntime.setTheme` while the
 * native splash is still up. Adaptive themes stay off: Unistyles' own
 * switching wants themes named `light` and `dark`, and ours are an accent in a
 * mode. `use-accent-bootstrap.ts` follows the device setting instead.
 */

type AppThemes = typeof themes

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation; the members are the theme table
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes,
  settings: { initialTheme: () => themeName(DEFAULT_ACCENT, modeOf(Appearance.getColorScheme())) },
})
