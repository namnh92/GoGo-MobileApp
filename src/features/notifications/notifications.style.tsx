import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.card,
    marginBottom: spacing[2],
  },
  rowUnread: { borderWidth: 1, borderColor: theme.accent.soft },
  dotColumn: { width: 10, alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.primary },
  time: { marginTop: 2 },
  notice: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  openProblem: { textAlign: 'center', paddingHorizontal: spacing[5], marginBottom: spacing[2] },
}))
