import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  list: {
    gap: theme.spacing[2],
    padding: theme.spacing[3],
    borderRadius: theme.radius.compact,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  number: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  more: { minHeight: touchTarget.min, justifyContent: 'center', borderRadius: theme.radius.compact },
  morePressed: { backgroundColor: theme.surface.subtle },
}))
