import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  root: { backgroundColor: theme.redesign.canvas },
  row: { minHeight: touchTarget.min + spacing[5], paddingHorizontal: spacing[4], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  subScreenRow: { minHeight: touchTarget.min + spacing[3], paddingVertical: spacing[1] },
  identity: { flex: 1, minWidth: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flexShrink: 1, textAlign: 'left' },
  subtitle: { marginTop: spacing[1] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  button: { minWidth: touchTarget.min, minHeight: touchTarget.min, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] },
  disabled: { backgroundColor: theme.surface.subtle },
}))
