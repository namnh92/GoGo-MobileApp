import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
  section: { marginTop: spacing[6] },
  source: { marginTop: spacing[1] },
  orderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  fallback: { marginTop: spacing[3] },
  list: { gap: spacing[3], marginTop: spacing[3] },
  row: {
    borderRadius: radius.card,
    backgroundColor: neutral[50],
    padding: spacing[4],
    gap: spacing[1],
  },
  rowContent: { gap: spacing[1] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  author: { flexShrink: 1 },
  helpfulBtn: {
    alignSelf: 'flex-start',
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    marginTop: spacing[2],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: neutral[300],
    backgroundColor: neutral[0],
  },
  helpfulBtnActive: { borderColor: theme.accent.primary },
  helpfulPressed: { opacity: 0.85 },
  empty: { marginTop: spacing[3] },
  notice: { marginTop: spacing[3], gap: spacing[2], alignItems: 'flex-start' },
}))
