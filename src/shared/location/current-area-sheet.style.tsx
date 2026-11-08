import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 24 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.redesign.high, borderWidth: 0 },
  content: { paddingHorizontal: 8, gap: 16 },
  list: { flex: 1 },
}))
