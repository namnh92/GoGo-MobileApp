import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

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

  counterPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.subtle,
  },
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
  },
  subheaderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.primary },

  // The card is as tall as its content: a 4:3 photo over the facts, centred in
  // the space the header and the action row leave.
  deck: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[2], justifyContent: 'center' },
  card: {
    borderRadius: radius.hero,
    overflow: 'hidden',
    backgroundColor: theme.surface.card,
  },

  imageWrap: { aspectRatio: 1.3 },
  categoryBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: theme.surface.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
  },

  overImage: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  photoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: theme.surface.card,
  },
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

  footer: { padding: spacing[4], gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] },
  titleCol: { flex: 1, gap: 4 },
  priceCol: { alignItems: 'flex-end', maxWidth: '45%' },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  actions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing[6],
    marginTop: spacing[5],
    marginBottom: spacing[6],
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
  actionBtnStar: { width: 52, height: 52, borderRadius: 26 },
  // Pressed is a colour change only (#382) — the buttons no longer shrink.
  actionBtnPressed: { backgroundColor: theme.surface.subtle },
  actionBtnLike: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accent.primary },
  actionBtnLikePressed: { backgroundColor: theme.accent.pressed },
  actionBtnStarPressed: { backgroundColor: theme.surface.subtle },

  done: { flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  doneCard: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[7],
    paddingHorizontal: spacing[5],
    borderRadius: radius.hero,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  doneHalo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
    marginBottom: spacing[2],
  },
  doneBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primary,
  },
  doneText: { textAlign: 'center' },

  skeletonCard: { flex: 1, maxHeight: 520, borderRadius: radius.hero },
}))
