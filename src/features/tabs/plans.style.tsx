import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  createAction: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[3] },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing[2] },
  title: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  card: { marginBottom: theme.spacing[3] },
}))
