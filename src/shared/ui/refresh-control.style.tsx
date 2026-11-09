import { StyleSheet } from 'react-native-unistyles'
import { spacing } from './tokens'

export const styles = StyleSheet.create(theme => ({
  container: { flex: 1 },
  native: { opacity: 0 },
  indicator: {
    position: 'absolute', top: 0, alignSelf: 'center', zIndex: 1,
    padding: spacing[2], borderRadius: spacing[4], backgroundColor: theme.surface.canvas,
  },
}))
