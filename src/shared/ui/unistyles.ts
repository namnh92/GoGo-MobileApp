import { StyleSheet } from 'react-native-unistyles'

import { DEFAULT_ACCENT, themes } from '@/shared/ui/theme'

/**
 * Unistyles registration (ADR-0009). Imported from the app entry (`index.ts`)
 * right after `expo-router/entry`, so it runs before any route module — and
 * therefore before any `StyleSheet.create` — is evaluated. Jest loads it from
 * `setupFiles`, after `react-native-unistyles/mocks`.
 *
 * `initialTheme` is the default accent, not the saved one: the preference is
 * in AsyncStorage, which is asynchronous, so `AppProviders` reads it and calls
 * `UnistylesRuntime.setTheme` while the native splash is still up. Adaptive
 * themes stay off — dark mode is out of scope and would conflict with
 * `initialTheme`.
 */

type AppThemes = typeof themes

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation; the members are the theme table
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes,
  settings: { initialTheme: DEFAULT_ACCENT },
})
