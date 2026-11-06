import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create(theme => ({
  track: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: theme.redesign.container },
  tab: { flex: 1, minHeight: 34, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  selected: { backgroundColor: theme.redesign.card, ...theme.shadows.card },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: theme.redesign.low },
}))
