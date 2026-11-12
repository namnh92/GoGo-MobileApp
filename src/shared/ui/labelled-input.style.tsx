import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, type } from './tokens'
export const styles = StyleSheet.create(theme => ({
  field: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  shell: { padding: 3, borderRadius: 12, backgroundColor: theme.surface.card, borderWidth: 1, borderColor: theme.surface.card, ...theme.shadows.card },
  row: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: theme.surface.low },
  input: { ...theme.type.introBody, lineHeight: undefined, minWidth: 0, minHeight: 48, flex: 1, color: theme.text.primary },
  plain: { minHeight: 48, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderRadius: radius.compact, backgroundColor: theme.surface.subtle, borderWidth: 1, borderColor: theme.border.hairline },
  plainInput: { ...type.body },
  invalid: { borderColor: theme.status.danger },
  focus: { borderColor: theme.accent.primary },
  disabled: { opacity: 0.6 },
}))
