import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: { padding: 12 },
  photo: { height: 176, width: '100%', borderRadius: 16, overflow: 'hidden' },
  badge: { position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'flex-start' },
  body: { paddingTop: 12, paddingHorizontal: 4 },
  details: { paddingHorizontal: 4 },
  address: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border.hairline, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  supplement: { minHeight: 44, justifyContent: 'center' },
}))
