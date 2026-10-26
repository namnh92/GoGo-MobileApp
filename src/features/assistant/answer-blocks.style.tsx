import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  blocks: { gap: theme.spacing[3] },
  list: { gap: theme.spacing[2] },
  item: { flexDirection: 'row', gap: theme.spacing[2], alignItems: 'flex-start' },
  number: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 1,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8, marginHorizontal: 7, backgroundColor: theme.text.secondary },
  itemText: { flex: 1 },
  cite: { backgroundColor: theme.accent.soft, borderRadius: 6 },
}))
