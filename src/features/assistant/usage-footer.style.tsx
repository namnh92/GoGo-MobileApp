import { StyleSheet } from 'react-native-unistyles'
import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  row: { alignItems: 'stretch', minHeight: touchTarget.min, paddingHorizontal: spacing[4], backgroundColor: theme.surface.card },
  allowance: { minWidth: 0, paddingTop: spacing[2] },
}))
