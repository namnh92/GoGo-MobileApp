import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  rows: { gap: theme.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
  text: { flex: 1, minWidth: 0, gap: 2 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  changeBtn: { minHeight: 36, paddingHorizontal: theme.spacing[2], justifyContent: 'center', borderRadius: theme.radius.compact },
  changeBtnPressed: { backgroundColor: theme.surface.subtle },
}))
