import { StyleSheet } from 'react-native-unistyles'
import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], minHeight: touchTarget.min },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surface.container, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
}))
