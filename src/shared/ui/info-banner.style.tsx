import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create(theme => ({
  card: { padding: 16, borderRadius: 12, gap: 8 },
  coffee: { padding: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  fill: { flex: 1, minWidth: 0 },
  coffeeIcon: { width: 48, height: 48, borderRadius: 8, backgroundColor: theme.redesign.card, alignItems: 'center', justifyContent: 'center', marginRight: 4, ...theme.shadows.card },
  footer: { paddingTop: 4, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  footerLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.redesign.greenText },
}))
