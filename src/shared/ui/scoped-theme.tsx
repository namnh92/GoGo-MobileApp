import { createContext, useContext, type PropsWithChildren } from 'react'
import { ScopedTheme, useUnistyles } from 'react-native-unistyles'

import { themes, type ThemeName } from '@/shared/ui/theme'

const ThemeScope = createContext<ThemeName | null>(null)

/**
 * Keep native styles and JS colour props on the same, reactive theme scope.
 * Unistyles 3.2.5 retains the hook's mounted theme when a scope name changes.
 */
export function ThemeScopeProvider({ name, children }: PropsWithChildren<{ name: ThemeName }>) {
  return <ScopedTheme name={name}><ThemeScope.Provider value={name}>{children}</ThemeScope.Provider></ScopedTheme>
}

/** Outside a preview, retain the running theme and its Unistyles subscription. */
export function useAppTheme() {
  const name = useContext(ThemeScope)
  const { theme } = useUnistyles()
  return name === null ? theme : themes[name]
}
