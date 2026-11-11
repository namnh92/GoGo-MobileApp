import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  // Keep the three short actions readable at 320pt; large text can grow vertically.
  action: { paddingHorizontal: spacing[1] },
  content: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[5] },
  icon: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: theme.accent.soft, alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center' },
}))
