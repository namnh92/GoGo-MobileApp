import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  mapFullscreen: { flex: 1, backgroundColor: theme.surface.canvas },
  mapExpand: { position: 'absolute', left: spacing[4], backgroundColor: theme.surface.card, borderRadius: 16 },
  mapBlock: { flex: 1, minHeight: 0 },
}))
