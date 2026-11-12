import { StyleSheet } from 'react-native-unistyles'
import { touchTarget } from '@/shared/ui/tokens'
export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[4], gap: theme.spacing[3] },
  rows: { gap: theme.spacing[2] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  title: { flex: 1 },
  add: { width: touchTarget.min, height: touchTarget.min },
  row: { marginHorizontal: -theme.spacing[4] },
  rowContent: { paddingVertical: theme.spacing[1], paddingHorizontal: theme.spacing[4] },
  separator: { width: theme.spacing[2] },
}))
