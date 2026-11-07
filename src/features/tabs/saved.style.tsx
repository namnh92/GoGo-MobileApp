import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  linkCard: { padding: 12, marginTop: 16, borderRadius: 16, backgroundColor: theme.redesign.card, gap: 8 },
  linkRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  linkInput: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, borderRadius: 8, backgroundColor: theme.redesign.container, color: theme.redesign.ink },
  cardMenu: { position: 'absolute', top: 12, right: 12, backgroundColor: theme.redesign.card },
  map: { height: 360 },
  header: { paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPlaceBtn: {
    marginLeft: 'auto',
  },
  filterRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  list: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  /** ADM-205 — province, then commune; each header is a screen-reader heading. */
  group: { marginBottom: spacing[6] },
  groupHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  groupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent.primary },
  subgroup: { marginBottom: spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  gridItem: { width: '48%' },
  // A place is the full-width Stitch card; plans keep their two-up tiles.
  placeItem: { width: '100%' },
  unavailable: { width: '100%', padding: spacing[3], gap: spacing[2] },
  unavailableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  unavailableText: { flex: 1 },
}))
