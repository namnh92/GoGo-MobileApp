import { StyleSheet } from 'react-native-unistyles'
import { overlay } from './tokens'

export const styles = StyleSheet.create(theme => ({
  surface: { backgroundColor: theme.surface.card, borderColor: theme.border.hairline, borderWidth: 1, borderRadius: 24, ...theme.shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  reason: { marginTop: 10, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.status.dangerSoft, backgroundColor: theme.status.dangerSoft, flexDirection: 'row', alignItems: 'center', gap: 6 },
  credits: { marginTop: 6, gap: 2 },
  photoCredits: { position: 'absolute', bottom: 10, left: 10, right: 10, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: overlay.scrimText },
  skeleton: { padding: 16, gap: 10 },
  skeletonRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  skeletonThumb: { width: 48, height: 48 },
}))
