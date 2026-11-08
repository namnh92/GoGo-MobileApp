import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  face: { borderRadius: theme.radius.pill, backgroundColor: theme.accent.primary, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: theme.accent.soft },
  inverted: { backgroundColor: theme.surface.card },
}))
