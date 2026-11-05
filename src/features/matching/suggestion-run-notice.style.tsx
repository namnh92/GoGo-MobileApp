import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[6],
  },
  content: { alignItems: 'center', gap: spacing[3] },
  halo: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
    marginBottom: spacing[2],
  },
  tile: {
    width: 104,
    height: 104,
    borderRadius: radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  badge: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[5],
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing[2] },
  error: { textAlign: 'center' },
  relaxCard: { alignSelf: 'stretch', gap: theme.spacing[2], padding: theme.spacing[4], marginTop: theme.spacing[4] },
  relaxRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  relaxLabel: { flex: 1, minWidth: 0 },
}))
