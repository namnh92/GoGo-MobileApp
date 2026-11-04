import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Solid full-width row card: `radius-card`, `shadow-card`, tile · text · arrow. */
export const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[4],
    minHeight: touchTarget.min + theme.spacing[6],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  cardPressed: { backgroundColor: theme.surface.subtle },
  cardDisabled: { backgroundColor: theme.surface.subtle, shadowOpacity: 0, elevation: 0 },
  tile: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
}))
