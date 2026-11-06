import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create(theme => ({
  field: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  shell: { padding: 3, borderRadius: 12, backgroundColor: theme.redesign.card, borderWidth: 1, borderColor: theme.redesign.card, ...theme.shadows.card },
  row: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: theme.redesign.low },
  input: { ...theme.type.introBody, lineHeight: undefined, minWidth: 0, height: 48, flex: 1, color: theme.redesign.ink },
  invalid: { borderColor: theme.status.danger },
  focus: { borderColor: theme.accent.primary },
  disabled: { opacity: 0.6 },
}))
