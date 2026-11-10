import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 32 },
  form: { gap: 16 },
  actions: { marginTop: 'auto', paddingTop: 24, gap: 12 },
  centered: { textAlign: 'center' },
  link: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  linkText: { textDecorationLine: 'underline' },
  error: { marginTop: 16 },
  digits: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  digit: { ...theme.type.introHeading, lineHeight: undefined, width: 48, flexShrink: 1, minWidth: 40, height: 54, textAlign: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.border.outline, backgroundColor: theme.surface.card, color: theme.text.primary },
  digitFocused: { borderWidth: 2, borderColor: theme.accent.primary },
  requirements: { padding: 16, borderWidth: 1, borderColor: theme.border.outline, borderRadius: 16, backgroundColor: theme.surface.card },
  visibility: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
}))
