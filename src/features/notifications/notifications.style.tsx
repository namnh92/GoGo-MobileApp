import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

const { neutral } = colors

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
  kind: { ...type.body, color: neutral[700] },
  kindUnread: { fontWeight: '700', color: neutral[900] },
  time: { ...type.caption, color: neutral[500], marginTop: 2 },
  notice: {
    ...type.bodySmall,
    color: neutral[700],
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  openProblem: { ...type.bodySmall, color: neutral[700], textAlign: 'center', paddingHorizontal: spacing[5], marginBottom: spacing[2] },
}))
