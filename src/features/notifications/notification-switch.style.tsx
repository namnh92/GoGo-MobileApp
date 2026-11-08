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
  card: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginTop: 0, gap: spacing[2], borderRadius: 0, shadowOpacity: 0, elevation: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    backgroundColor: theme.redesign.container,
  },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  deviceText: { flex: 1 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { minHeight: 40, justifyContent: 'center' },
  switch: { alignSelf: 'center' },
  deviceCard: { paddingHorizontal: spacing[4], paddingBottom: spacing[2], gap: spacing[2], borderRadius: 0, shadowOpacity: 0, elevation: 0 },
  caption: { paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  error: { marginTop: spacing[3] },
}))
