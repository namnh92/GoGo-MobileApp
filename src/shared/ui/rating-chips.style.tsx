import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  google: { maxWidth: '100%', backgroundColor: theme.redesign.container, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.spacing[1] + theme.spacing[1] / 2 },
  gogo: { maxWidth: '100%', backgroundColor: theme.redesign.violetSoft, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.spacing[1] + theme.spacing[1] / 2 },
  detailBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  detailGoogle: { backgroundColor: theme.redesign.card, borderWidth: 1, borderColor: theme.redesign.highest },
  stackedRow: { flexDirection: 'column', alignItems: 'flex-start' },
  compactRow: { gap: 4, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' },
  compactBadge: { paddingHorizontal: 4, paddingVertical: 2, flexShrink: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
}))
