import { StyleSheet } from 'react-native'

import { colors, glassFx, onDark, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  counter: { ...type.label, color: neutral[900] },
  header: { ...type.bodySmall, color: neutral[500], fontWeight: '600' },
  subheader: { ...type.caption, color: neutral[300] },

  progressTrack: {
    marginHorizontal: spacing[5],
    height: 4,
    borderRadius: 2,
    backgroundColor: neutral[100],
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  progressFill: { height: '100%', backgroundColor: brand.coral, borderRadius: 2 },

  deck: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  card: {
    flex: 1,
    maxHeight: 520,
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: glassFx.solid,
  },

  // Imagery carries the card (spec §17): two thirds of it, with a gradient
  // rather than a flat scrim so the top of the photo stays bright.
  imageWrap: { flex: 1 },
  imageGradient: { ...StyleSheet.absoluteFillObject },
  categoryBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: glassFx.solid,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  categoryLabel: { ...type.caption, fontWeight: '700', color: neutral[900] },

  overImage: { position: 'absolute', left: spacing[4], right: spacing[4], bottom: spacing[4], gap: 4 },
  overTitle: { ...type.display, color: neutral[0] },
  overMeta: { ...type.bodySmall, color: onDark.strong },

  /** Swipe verdict stamps — large, rotated, and worded, never colour alone. */
  overlay: {
    position: 'absolute',
    top: spacing[5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.compact,
    borderWidth: 3,
    borderColor: glassFx.borderBright,
  },
  overlayLabel: { ...type.title1, color: neutral[0], letterSpacing: 1 },

  footer: { padding: spacing[4], gap: spacing[2] },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  price: { ...type.title2, color: neutral[900] },
  priceUnit: { ...type.bodySmall, color: neutral[500] },
  priceUnknown: { ...type.bodySmall, color: neutral[300] },
  meta: { ...type.bodySmall, color: neutral[500] },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  open: { ...type.caption, fontWeight: '700', color: brand.mint },
  closed: { ...type.caption, fontWeight: '700', color: neutral[500] },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing[5],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  actionCol: { alignItems: 'center', gap: 4, minWidth: 72 },
  actionBtn: {
    width: 64,
    height: 64,
    minWidth: touchTarget.min,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnStar: { width: 56, height: 56, borderRadius: 28, backgroundColor: brand.lavenderSoft },
  actionCaption: { ...type.caption, color: neutral[500] },

  skeletonCard: { flex: 1, maxHeight: 520, borderRadius: radius.hero },
})
