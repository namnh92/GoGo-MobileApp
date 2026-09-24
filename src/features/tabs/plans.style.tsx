import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  createAction: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[3] },
  tabs: { flexDirection: 'row', gap: theme.spacing[2], paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[3] },
  tab: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  // Selection is also `accessibilityState.selected`; the fill is not the only signal.
  tabSelected: { backgroundColor: theme.accent.soft },
  title: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  card: { marginBottom: theme.spacing[3] },
}))
