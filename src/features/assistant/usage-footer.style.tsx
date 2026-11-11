import { StyleSheet } from 'react-native-unistyles'
import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: touchTarget.min, paddingLeft: spacing[4], backgroundColor: theme.surface.card },
  allowance: { flex: 1, minWidth: 0 },
}))
