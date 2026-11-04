import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  syncState: {
    minHeight: touchTarget.min,
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  subTitle: {
    textTransform: 'uppercase',
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  card: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginTop: spacing[3], gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: touchTarget.min,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  deviceText: { flex: 1 },
  rowText: { flex: 1, gap: 2 },
  deviceCard: { padding: spacing[4], gap: spacing[3] },
  caption: { marginTop: spacing[3] },
  error: { marginTop: spacing[3] },
}))
