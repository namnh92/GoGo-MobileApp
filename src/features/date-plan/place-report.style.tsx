import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  body: { gap: theme.spacing[4], paddingBottom: theme.spacing[5] },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  note: { minHeight: 100, padding: theme.spacing[3], color: theme.text.primary, backgroundColor: theme.surface.subtle, borderRadius: theme.radius.compact },
}))
