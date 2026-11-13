import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, tabRootSpacing, touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  heroRoot: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroRow: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroBack: { backgroundColor: theme.surface.card, borderRadius: radius.pill },
  heroPill: { backgroundColor: theme.surface.card, padding: 8, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.status.warning },
  dangerDot: { backgroundColor: theme.status.danger },
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
