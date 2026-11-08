import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[3], gap: spacing[4] },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  device: { flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3] },
  deviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.redesign.greenSoft, alignItems: 'center', justifyContent: 'center' },
  master: { padding: spacing[4] },
  heroIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.accent.soft, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1], marginBottom: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, backgroundColor: theme.accent.soft },
  note: { marginTop: spacing[3] },
  loading: { marginTop: spacing[4], gap: spacing[3] },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  unavailable: { marginTop: -spacing[3] },
  category: { flexDirection: 'row', alignItems: 'center', padding: spacing[4], gap: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: theme.redesign.low },
  categoryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoIcon: { backgroundColor: theme.redesign.violetSoft },
  successIcon: { backgroundColor: theme.redesign.greenSoft },
  accentIcon: { backgroundColor: theme.accent.soft },
  quiet: { backgroundColor: theme.redesign.container, borderRadius: 12, padding: spacing[4], gap: spacing[2], marginTop: spacing[2] },
}))
