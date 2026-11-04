import { StyleSheet } from 'react-native-unistyles'

import { fill, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({

  progressTrack: {
    marginHorizontal: spacing[5],
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.surface.subtle,
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
    backgroundColor: theme.surface.card,
  },

  // Imagery carries the card (spec §17): two thirds of it, with a gradient
  // rather than a flat scrim so the top of the photo stays bright.
  imageWrap: { flex: 1 },
  imageGradient: { ...fill },
  categoryBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: theme.surface.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
  },

  overImage: { position: 'absolute', left: spacing[4], right: spacing[4], bottom: spacing[4], gap: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressText: { flexShrink: 1 },

  /** Swipe verdict stamps — large, rotated, and worded, never colour alone. */
  overlay: {
    position: 'absolute',
    top: spacing[5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.compact,
    borderWidth: 3,
    borderColor: theme.text.inverse,
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
  actionBtnStar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.status.infoSoft },
  // Pressed is a colour change only (#382) — the buttons no longer shrink.
  actionBtnPressed: { backgroundColor: theme.surface.subtle },
  actionBtnLike: { backgroundColor: theme.accent.primary },
  actionBtnLikePressed: { backgroundColor: theme.accent.pressed },
  actionBtnStarPressed: { backgroundColor: theme.surface.subtle },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[3] },
  doneBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primary,
    marginBottom: spacing[3],
  },
  doneText: { textAlign: 'center' },

  skeletonCard: { flex: 1, maxHeight: 520, borderRadius: radius.hero },
}))
