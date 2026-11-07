import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  header: { backgroundColor: theme.redesign.canvas, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing[4], gap: theme.spacing[2], minHeight: 64 },
  title: { flex: 1 },
  content: { paddingHorizontal: theme.spacing[4], gap: theme.spacing[4] },
  version: { textAlign: 'center', marginVertical: theme.spacing[5] },
}))
