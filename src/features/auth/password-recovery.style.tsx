import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  title: { marginBottom: spacing[1] },
  subtitle: { marginBottom: spacing[4] },
  form: { gap: spacing[3] },
  confirmation: { marginTop: spacing[2] },
  actions: { marginTop: 'auto', paddingTop: spacing[4], gap: spacing[3] },
  centered: { textAlign: 'center' },
  link: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  linkText: { textDecorationLine: 'underline' },
  error: { marginTop: spacing[3] },
  digits: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  digit: { ...theme.type.introHeading, lineHeight: undefined, width: 48, flexShrink: 1, minWidth: 44, height: 54, textAlign: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.border.outline, backgroundColor: theme.surface.card, color: theme.text.primary },
  digitFocused: { borderWidth: 2, borderColor: theme.accent.primary },
  requirements: { marginTop: spacing[2], padding: spacing[3], borderWidth: 1, borderColor: theme.border.outline, borderRadius: 16, backgroundColor: theme.surface.card },
  visibility: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
}))
