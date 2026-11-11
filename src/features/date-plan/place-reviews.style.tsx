import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  section: { marginTop: spacing[6] },
  sourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.status.successSoft,
  },
  source: { flex: 1 },
  // The two orders read as one segmented switch on a tonal track.
  orderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: chipRowGap,
    marginTop: spacing[3],
    alignSelf: 'flex-start',
    padding: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  fallback: { marginTop: spacing[3] },
  list: { gap: spacing[3], marginTop: spacing[3] },
  row: {
    borderRadius: radius.card,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    ...theme.shadows.card,
    padding: spacing[4],
    gap: spacing[1],
  },
  rowContent: { gap: spacing[2] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  authorBlock: { flex: 1 },
  author: { flexShrink: 1 },
  reviewText: { marginTop: spacing[1] },
  divider: { height: 1, marginTop: spacing[2], backgroundColor: theme.border.hairline },
  helpfulBtn: {
    alignSelf: 'flex-start',
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    marginTop: spacing[2],
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.subtle,
  },
  helpfulBtnActive: { borderColor: theme.accent.primary },
  // Pressed is a colour change only (#382).
  helpfulPressed: { backgroundColor: theme.accent.soft },
  empty: { marginTop: spacing[3] },
  notice: { marginTop: spacing[3], gap: spacing[2], alignItems: 'flex-start' },
}))
