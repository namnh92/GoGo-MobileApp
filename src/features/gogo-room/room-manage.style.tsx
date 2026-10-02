import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
  scheduleInput: { ...type.body, color: neutral[900], borderWidth: 1, borderColor: neutral[300], borderRadius: radius.compact, padding: spacing[3], minHeight: touchTarget.min },
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tier: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: neutral[100],
  },
  tierActive: { backgroundColor: theme.accent.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min,
    borderTopWidth: 1,
    borderTopColor: neutral[100],
    paddingTop: spacing[3],
  },
  rowMeta: { marginTop: 2 },
  rowAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  notice: { textAlign: 'center', marginTop: spacing[4] },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing[4], marginTop: spacing[2] },
}))
