import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  body: { paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[6], paddingBottom: theme.spacing[4], gap: theme.spacing[3] },
  grid: { gap: theme.spacing[3], marginTop: theme.spacing[3] },
  gridRow: { flexDirection: 'row', gap: theme.spacing[3] },
}))
