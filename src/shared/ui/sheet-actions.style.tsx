import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: theme.spacing[2], paddingTop: theme.spacing[4] },
  action: { flex: 1, flexBasis: 0, minWidth: 0 },
}))
