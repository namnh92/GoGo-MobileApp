import { StyleSheet } from 'react-native'

import { colors, glassFx, onDark, overlay, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  // --- list (default) ------------------------------------------------------
  listCard: { flexDirection: 'row', overflow: 'hidden' },
  listThumb: { width: 116, alignSelf: 'stretch', minHeight: 116 },
  listBody: { flex: 1, paddingVertical: spacing[3], paddingHorizontal: spacing[3], gap: 3 },

  // --- grid ---------------------------------------------------------------
  gridCard: { overflow: 'hidden' },
  gridThumbWrap: { height: 124, backgroundColor: neutral[100] },
  gridBody: { padding: spacing[3], gap: 3 },

  // --- hero ---------------------------------------------------------------
  heroCard: { height: 260, borderRadius: radius.hero, overflow: 'hidden', justifyContent: 'flex-end' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: overlay.scrim },
  heroBody: { padding: spacing[5], gap: 4 },
  heroName: { ...type.title1, color: neutral[0] },
  heroMeta: { ...type.bodySmall, color: onDark.medium },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },

  // --- shared text rows ---------------------------------------------------
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
  name: { ...type.title2, color: neutral[900], flex: 1 },
  category: { ...type.bodySmall, color: neutral[500] },
  meta: { ...type.bodySmall, color: neutral[500] },
  price: { ...type.label, color: neutral[900] },
  priceUnknown: { ...type.bodySmall, color: neutral[500] },
  priceFree: { ...type.label, color: brand.mint },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingSource: { ...type.caption, color: neutral[500], fontWeight: '600' },
  ratingValue: { ...type.label, color: neutral[900] },
  ratingCount: { ...type.caption, color: neutral[500] },

  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  open: { ...type.caption, color: brand.mint, fontWeight: '600' },
  closed: { ...type.caption, color: neutral[500], fontWeight: '600' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },

  // --- save toggle --------------------------------------------------------
  saveBtn: {
    width: 32,
    height: 32,
    minWidth: touchTarget.min - 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glassFx.pill,
  },
  saveBtnOnPhoto: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    backgroundColor: glassFx.solid,
  },
  saveGlyph: { fontSize: 15 },

  attribution: { ...type.caption, color: neutral[500], marginTop: 2 },
})
