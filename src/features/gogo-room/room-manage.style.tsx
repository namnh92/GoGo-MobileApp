import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  scheduleInput: { ...type.body, color: theme.text.primary, backgroundColor: theme.surface.subtle, borderWidth: 1, borderColor: theme.text.tertiary, borderRadius: radius.compact, padding: spacing[3], minHeight: touchTarget.min },
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tier: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  tierActive: { backgroundColor: theme.accent.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min,
    borderTopWidth: 1,
    borderTopColor: theme.border.hairline,
    paddingTop: spacing[3],
  },
  rowMeta: { marginTop: 2 },
  rowAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  notice: { textAlign: 'center', marginTop: spacing[4] },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.status.danger,
  },
}))
