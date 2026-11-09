import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  content: { flexGrow: 1, paddingTop: spacing[2], paddingHorizontal: spacing[4] },
  preview: { gap: spacing[4], marginBottom: spacing[4] },
  host: { padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.compact },
  hostHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  factIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.redesign.container },
  factText: { flex: 1, minWidth: 0 },
  badge: { alignSelf: 'flex-start', backgroundColor: theme.accent.soft, borderWidth: 0 },
  title: { marginTop: spacing[4], marginBottom: spacing[4] },
  details: { borderRadius: radius.compact, padding: spacing[4], gap: spacing[3], marginBottom: spacing[4] },
  detailsTitle: {},
  noAccountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  nameInput: {
    ...type.body,
    height: Math.max(48, touchTarget.min),
    lineHeight: undefined,
    borderRadius: radius.compact,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.redesign.low,
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
