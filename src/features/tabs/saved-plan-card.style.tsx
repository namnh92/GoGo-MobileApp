import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { width: '100%', gap: theme.spacing[2] },
  body: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], minHeight: touchTarget.min },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  warning: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  warningText: { flex: 1 },
  text: { flex: 1, minWidth: 0 },
}))
