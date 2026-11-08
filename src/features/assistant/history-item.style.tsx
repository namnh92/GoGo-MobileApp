import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  rowActive: { borderWidth: 2, borderColor: theme.accent.primary },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: 96,
    paddingLeft: theme.spacing[4],
    paddingRight: theme.spacing[1],
    paddingVertical: theme.spacing[4],
    borderRadius: theme.radius.compact,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  title: { flex: 1, minWidth: 0 },
  current: { alignSelf: 'flex-start', marginTop: theme.spacing[1] },
  menu: {
    width: touchTarget.min,
    height: touchTarget.min,
    marginRight: theme.spacing[1],
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: { backgroundColor: theme.accent.soft },
}))
