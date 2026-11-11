import { StyleSheet } from 'react-native-unistyles'

/**
 * GoGo AI opened over the app (GoGo-MobileApp#379/#378): flat ivory canvas,
 * the thread or Welcome above the glass composer.
 */
export const styles = StyleSheet.create(theme => ({
  screen: { flex: 1, backgroundColor: theme.surface.canvas },
  flex: { flex: 1 },
  footer: (bottomInset: number) => ({ paddingBottom: bottomInset, backgroundColor: theme.surface.card }),
}))
