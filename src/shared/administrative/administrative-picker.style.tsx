import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  root: { gap: spacing[2] },
  row: { minHeight: 48, padding: spacing[3], borderBottomWidth: 1, borderBottomColor: theme.border.hairline },
  /** Inside the full-height `Sheet`, which pads the sides and the safe area. */
  sheetBody: { flex: 1, gap: spacing[2] },
}))
