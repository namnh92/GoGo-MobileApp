import { StyleSheet } from 'react-native-unistyles'
import { fill } from './tokens'
export const styles = StyleSheet.create(theme => ({
  fill: { ...fill },
  nativeFill: { flex: 1 },
  bubble: { backgroundColor: theme.glass.opaque },
  panel: { backgroundColor: theme.glass.translucent },
  header: { backgroundColor: theme.glass.header },
  solid: { backgroundColor: theme.surface.card },
  solidHeader: { backgroundColor: theme.surface.canvas },
}))
