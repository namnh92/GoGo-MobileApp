import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[4] },
  seedList: { flexDirection: 'column', gap: spacing[6], paddingTop: spacing[3], paddingRight: spacing[3], overflow: 'visible' },
  addPlace: { alignItems: 'flex-start', marginBottom: spacing[3] },
  group: { marginTop: spacing[3] },
  error: { marginTop: spacing[4] },
})
