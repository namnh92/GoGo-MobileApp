import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[4] },
  sectionTitle: { marginTop: spacing[4], marginBottom: spacing[3] },
  seedHint: { marginBottom: spacing[3], marginTop: -spacing[2] },
  seedList: { flexDirection: 'column', gap: spacing[6], paddingVertical: spacing[4], overflow: 'visible' },
  addPlace: { alignItems: 'flex-start', marginTop: spacing[2], marginBottom: spacing[3] },
  result: { marginTop: spacing[3] },
  error: { marginTop: spacing[4] },
})
