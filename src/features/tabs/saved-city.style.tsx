import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  canvas: { backgroundColor: theme.surface.inset },
  list: { paddingHorizontal: 16, paddingTop: 20 },
  subgroup: { marginBottom: 24 },
  wardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  wardCount: { minWidth: 20, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.disabled },
  cards: { gap: 14 },
}))
