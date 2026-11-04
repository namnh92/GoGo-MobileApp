import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  createAction: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[3] },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing[2] },
  // One segmented track; the selected segment is a filled pill.
  tabs: {
    flexDirection: 'row',
    gap: theme.spacing[1],
    marginHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[3],
    padding: theme.spacing[1],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  // Selection is also `accessibilityState.selected` and the label's weight; the fill is not the only signal.
  tabSelected: { backgroundColor: theme.accent.primary },
  title: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  card: { marginBottom: theme.spacing[3] },
}))
