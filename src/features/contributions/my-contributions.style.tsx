import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  list: { padding: theme.spacing[5], gap: theme.spacing[4], flexGrow: 1 },
  filters: { gap: theme.spacing[2], paddingHorizontal: theme.spacing[5], paddingVertical: theme.spacing[3] },
  card: { padding: theme.spacing[4], gap: theme.spacing[3], borderRadius: theme.radius.card, backgroundColor: theme.surface.card },
  row: { flexDirection: 'row', gap: theme.spacing[3], alignItems: 'center' },
  details: { flex: 1, gap: theme.spacing[2] },
  photo: { width: theme.spacing[7] * 2, height: theme.spacing[7] * 2, borderRadius: theme.radius.card, backgroundColor: theme.surface.subtle, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  footer: { padding: theme.spacing[5] },
}))
