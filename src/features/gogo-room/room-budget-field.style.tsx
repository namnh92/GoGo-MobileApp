import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  section: { gap: spacing[2] },
  flex: { flex: 1 },
  heading: { marginBottom: spacing[4] },
  options: { gap: spacing[3], paddingBottom: spacing[4] },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
})
