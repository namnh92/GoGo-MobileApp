import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  google: { maxWidth: '100%', backgroundColor: theme.surface.container, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.spacing[1] + theme.spacing[1] / 2 },
  gogo: { maxWidth: '100%', backgroundColor: theme.status.infoSoft, paddingHorizontal: theme.spacing[2], paddingVertical: theme.spacing[1], borderRadius: theme.spacing[1] + theme.spacing[1] / 2 },
  detailBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  detailGoogle: { backgroundColor: theme.surface.card, borderWidth: 1, borderColor: theme.surface.highest },
  stackedRow: { flexDirection: 'column', alignItems: 'flex-start' },
  compactRow: { gap: chipRowGap, flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' },
  compactBadge: { paddingHorizontal: 4, paddingVertical: 2, flexShrink: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
}))
