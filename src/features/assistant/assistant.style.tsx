import { StyleSheet } from 'react-native-unistyles'

/**
 * GoGo AI opened over the app (GoGo-MobileApp#379): flat ivory canvas, the
 * welcome block left-aligned in the 20pt gutter, the context chip at the
 * bottom where the composer will sit (#378).
 */
export const styles = StyleSheet.create(theme => ({
  screen: { flex: 1, backgroundColor: theme.surface.canvas },
  body: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[6], gap: theme.spacing[3] },
  greeting: { marginTop: theme.spacing[2] },
  question: { marginTop: theme.spacing[3], gap: theme.spacing[1] },
  context: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[2] },
}))
