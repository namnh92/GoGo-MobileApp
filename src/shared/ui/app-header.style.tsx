import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, tabRootSpacing, touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  root: { backgroundColor: theme.surface.canvas },
  tabRoot: { paddingBottom: tabRootSpacing.headerContent },
  row: { minHeight: touchTarget.min + spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[1], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sheetRoot: { backgroundColor: theme.surface.card },
  subScreenRow: { minHeight: touchTarget.min + spacing[3], paddingVertical: spacing[1] },
  identity: { flex: 1, minWidth: 0, gap: spacing[1] },
  // Keep accessory hitSlop inside its parent without adding space between lines.
  accessoryIdentity: { paddingVertical: spacing[4] },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  brandDivider: { width: 1, height: spacing[5], backgroundColor: theme.border.outline },
  centeredTitle: { textAlign: 'center' },
  balancedActions: { minWidth: touchTarget.min },
  title: { flexShrink: 1, textAlign: 'left' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  button: { minWidth: touchTarget.min, minHeight: touchTarget.min, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
  disabled: { backgroundColor: theme.surface.subtle },
}))
