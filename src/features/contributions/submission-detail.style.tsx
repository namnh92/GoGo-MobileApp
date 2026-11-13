import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  scroll: { paddingBottom: 24 },
  hero: { height: 270, position: 'relative', backgroundColor: theme.surface.card },
  photo: { flex: 1 },
  photoFooter: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 8, flexDirection: 'row', alignItems: 'flex-end' },
  maps: { marginLeft: 'auto', alignSelf: 'flex-end', backgroundColor: theme.surface.card },
  credit: { flex: 1, minWidth: 0 },
  banner: { padding: 16, gap: 8, backgroundColor: theme.status.warningSoft },
  rejected: { backgroundColor: theme.status.dangerSoft },
  content: { padding: 16, gap: 16 },
  section: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceTile: { flexGrow: 1, flexBasis: 130 },
  tile: { padding: 12, gap: 6, borderRadius: 12, backgroundColor: theme.surface.canvas },
  quote: { backgroundColor: theme.surface.canvas, padding: 12, borderRadius: 12 },
  footer: { textAlign: 'center' },
}))
