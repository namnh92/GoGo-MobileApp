import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  hidden: { display: 'none' },
  editorBody: { gap: spacing[4], paddingTop: spacing[2] },
  fullBody: { flex: 1 },
  shrink: { flexShrink: 1 },
})
