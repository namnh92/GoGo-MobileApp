import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[2],
    backgroundColor: theme.accent.soft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing[4],
  },
  title: { marginBottom: spacing[5] },
  details: { padding: spacing[5], gap: spacing[3], marginBottom: spacing[6] },
  detailsTitle: {},
  noAccountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  nameInput: {
    ...type.body,
    minHeight: touchTarget.min,
    borderRadius: radius.compact,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.surface.subtle,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.status.dangerSoft,
  },
  errorText: { flex: 1 },
}))
