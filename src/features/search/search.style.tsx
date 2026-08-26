import { StyleSheet } from 'react-native'

import { colors, glassFx, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.compact,
    backgroundColor: glassFx.chip,
    borderWidth: 1,
    borderColor: neutral[100],
    paddingHorizontal: spacing[4],
    fontSize: 14,
    color: neutral[900],
  },
  filterRow: { gap: spacing[2], paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  filterBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: 8,
    borderRadius: radius.compact,
    backgroundColor: glassFx.chip,
    borderWidth: 1,
    borderColor: neutral[100],
  },
  filterBtnActive: { backgroundColor: neutral[900], borderColor: neutral[900] },
  filterLabel: { fontSize: 13, fontWeight: '600', color: neutral[500] },
  filterLabelActive: { color: neutral[0] },
  card: { flexDirection: 'row', overflow: 'hidden', marginBottom: spacing[3] },
  thumb: { width: 96, alignSelf: 'stretch', minHeight: 96 },
  cardBody: { flex: 1, padding: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
  title: { fontSize: 14, fontWeight: '700', color: neutral[900], flexShrink: 1 },
  bookmark: { fontSize: 16 },
  meta: { fontSize: 12, color: neutral[500], marginTop: 2 },
  statusOpen: { fontSize: 12, fontWeight: '600', color: brand.mint },
  statusClosed: { fontSize: 12, fontWeight: '600', color: brand.coral },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2], alignItems: 'center' },
  score: { fontSize: 11, fontWeight: '700', color: brand.coral },
  empty: { alignItems: 'center', paddingVertical: spacing[8], paddingHorizontal: spacing[5] },
  emptyEmoji: { fontSize: 36, marginBottom: spacing[3] },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: neutral[900] },
  emptyHint: { fontSize: 13, color: neutral[500], marginTop: 4, textAlign: 'center', lineHeight: 19 },
  addNewBtn: { marginTop: spacing[4], alignSelf: 'stretch' },
})
