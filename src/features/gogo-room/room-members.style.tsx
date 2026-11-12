import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[4], marginBottom: spacing[4], gap: spacing[3] },
  flex: { flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min,
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
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
