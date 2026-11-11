import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay } from '@/shared/ui/tokens'

/** Centred confirmation card (#381). Solid, like every card (#295). */
export const styles = StyleSheet.create(theme => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[6],
  },
  backdrop: { ...fill, backgroundColor: overlay.backdrop },
  card: {
    alignSelf: 'stretch',
    maxWidth: 420,
    backgroundColor: theme.surface.card,
    borderRadius: theme.radius.card,
    padding: theme.spacing[5],
    gap: theme.spacing[2],
    ...theme.shadows.toast,
  },
  actionRow: { flexDirection: 'row' },
  actionCell: { flex: 1 },
  actions: { gap: theme.spacing[2], marginTop: theme.spacing[3] },
}))
