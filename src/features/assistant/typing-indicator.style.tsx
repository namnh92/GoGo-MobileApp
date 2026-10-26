import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], minHeight: 24 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent.primary },
}))
