import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  mapFullscreen: { flex: 1, backgroundColor: theme.redesign.canvas },
  mapExpand: { position: 'absolute', left: spacing[4], backgroundColor: theme.redesign.card, borderRadius: 16 },
  mapBlock: { flex: 1, minHeight: 0 },
}))
