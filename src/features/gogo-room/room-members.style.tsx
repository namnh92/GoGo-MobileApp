import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[4], gap: spacing[3] },
  rows: { gap: spacing[2] },
  flex: { flex: 1, gap: chipRowGap },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min,
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  lobbyRow: { paddingTop: spacing[1], paddingBottom: spacing[1] },
  rowSeparator: { borderTopWidth: 1, borderTopColor: theme.border.hairline },
  rowAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
  },
}))
