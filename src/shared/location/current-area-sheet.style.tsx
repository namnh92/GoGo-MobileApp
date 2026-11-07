import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 24 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.redesign.high, borderWidth: 0 },
  content: { paddingHorizontal: 8, gap: 16 },
  list: { flex: 1 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 8, paddingTop: 24 },
  clear: { flex: 1 },
  confirm: { flex: 2 },
}))
