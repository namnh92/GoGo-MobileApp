import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  createAction: { paddingHorizontal: theme.spacing[5], paddingBottom: theme.spacing[3] },
  planActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing[2] },
  card: { marginBottom: theme.spacing[3] },
}))
