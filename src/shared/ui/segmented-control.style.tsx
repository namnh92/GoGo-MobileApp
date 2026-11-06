import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create(theme => ({
  track: { flexDirection: 'row', paddingHorizontal: 4 },
  rail: { position: 'absolute', top: 1, bottom: 1, left: 0, right: 0, borderRadius: 999, backgroundColor: theme.redesign.container },
  tab: { flex: 1, minWidth: 44, minHeight: 44, paddingVertical: 5 },
  surface: { alignSelf: 'stretch', flexGrow: 1, minHeight: 34, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  compactTrack: { alignSelf: 'flex-start', flexShrink: 0 },
  compactRail: { top: 8, bottom: 8 },
  compactTab: { flex: 0, justifyContent: 'center', paddingVertical: 8 },
  compact: { flexDirection: 'row', flexGrow: 0, minHeight: 28, gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  selected: { backgroundColor: theme.redesign.card, ...theme.shadows.card },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: theme.redesign.low },
}))
