import { StyleSheet } from 'react-native-unistyles'

import { FAB_SIZE } from './assistant-entry'

/**
 * Design system `AssistantEntry variant="fab"`: 56pt `accent.primary` pill with
 * the CTA shadow; extended it carries "Ask GoGo AI". Pressed is a colour change
 * only (#382). The coachmark highlight is a 2pt accent ring with a card-white
 * gap, drawn outside the button so the button itself does not move.
 */
export const styles = StyleSheet.create(theme => ({
  dock: { position: 'absolute' },
  ring: {
    margin: -4,
    padding: 2,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.accent.primary,
    backgroundColor: theme.surface.card,
  },
  fab: {
    height: FAB_SIZE,
    minWidth: FAB_SIZE,
    paddingHorizontal: 13,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    ...theme.shadows.cta,
  },
  fabExtended: { paddingLeft: 14, paddingRight: theme.spacing[5] },
  fabPressed: { backgroundColor: theme.accent.pressed },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderWidth: 2,
    borderColor: theme.surface.canvas,
  },
}))
