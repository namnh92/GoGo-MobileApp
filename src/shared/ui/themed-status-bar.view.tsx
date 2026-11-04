import { StatusBar } from 'expo-status-bar'
import { useUnistyles } from 'react-native-unistyles'

/**
 * The status bar follows the app theme: light glyphs over a dark canvas, dark
 * glyphs over a light one. `useUnistyles` reads the same theme the rest of the
 * app is painted with, including the saved accent in either mode.
 */
export function ThemedStatusBar() {
  const { theme } = useUnistyles()
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
}
