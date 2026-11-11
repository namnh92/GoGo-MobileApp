import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[9] },
  card: { padding: spacing[4], gap: spacing[3] },
  entry: { padding: spacing[4], marginBottom: spacing[3], gap: spacing[2], backgroundColor: theme.surface.card, borderRadius: radius.compact },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], minHeight: touchTarget.min },
  label: { flex: 1 },
  pressed: { backgroundColor: theme.surface.container },
  account: { marginHorizontal: spacing[4], marginBottom: spacing[4], padding: spacing[4], backgroundColor: theme.surface.card, borderRadius: radius.compact },
  assistant: { paddingHorizontal: spacing[4], backgroundColor: theme.surface.card },
  skeleton: { gap: spacing[3], padding: spacing[4] },
}))
