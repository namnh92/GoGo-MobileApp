import { StyleSheet } from 'react-native-unistyles'

import { colors, fill, glassFx, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create(theme => ({

  progressTrack: {
    marginHorizontal: spacing[5],
    height: 4,
    borderRadius: 2,
    backgroundColor: neutral[100],
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  progressFill: { height: '100%', backgroundColor: theme.accent.primary, borderRadius: 2 },

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
  imageGradient: { ...fill },
  categoryBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: glassFx.solid,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
  },

  overImage: { position: 'absolute', left: spacing[4], right: spacing[4], bottom: spacing[4], gap: 4 },

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
  overlayLabel: { letterSpacing: 1 },

  footer: { padding: spacing[4], gap: spacing[2] },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  openDot: { width: 6, height: 6, borderRadius: 3 },
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

  skeletonCard: { flex: 1, maxHeight: 520, borderRadius: radius.hero },
}))
