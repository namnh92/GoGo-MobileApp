import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create(theme => ({
  rows: { gap: theme.spacing[2] },
  row: { marginHorizontal: -theme.spacing[4] },
  rowContent: { paddingVertical: theme.spacing[4], paddingHorizontal: theme.spacing[4] },
  leadingInset: { position: 'absolute', left: -theme.spacing[4], top: 0, bottom: 0, width: theme.spacing[4], backgroundColor: theme.surface.card },
  separator: { width: theme.spacing[4] },
}))
