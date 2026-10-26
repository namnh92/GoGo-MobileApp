import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.compact,
    backgroundColor: theme.surface.card,
  },
  rowActive: { borderWidth: 2, borderColor: theme.accent.primary },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    minHeight: 64,
    paddingLeft: theme.spacing[4],
    paddingRight: theme.spacing[1],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.radius.compact,
  },
  mainPressed: { backgroundColor: theme.surface.subtle },
  text: { flex: 1, minWidth: 0, gap: 2 },
  menu: {
    width: touchTarget.min,
    height: touchTarget.min,
    marginRight: theme.spacing[1],
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPressed: { backgroundColor: theme.surface.subtle },
  hit: { backgroundColor: theme.accent.soft },
}))
