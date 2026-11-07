import { StyleSheet } from 'react-native-unistyles'

import { overlay, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  importCard: { borderRadius: 12, overflow: 'hidden', backgroundColor: theme.redesign.card, ...theme.shadows.card },
  importBody: { padding: 16, gap: 12 },
  importFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  importFact: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.redesign.container },
  importNoPhotoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  importSave: { position: 'absolute', top: 8, right: 8 },
  importHoursOverlay: { position: 'absolute', bottom: 12, right: 12, borderRadius: 999, backgroundColor: theme.redesign.scrimStart, paddingHorizontal: 8, paddingVertical: 2 },
  importActions: { marginTop: 24, gap: 12 },
  /** Holds the card and, beside it, the save toggle positioned over it. */
  verifiedBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.redesign.verifiedFill },
  discoveryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  discoveryCard: { backgroundColor: theme.redesign.card, borderRadius: 20, overflow: 'hidden', ...theme.shadows.card },
  discoveryName: { flex: 1, minWidth: 0 },
  discoveryPrice: { flexShrink: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  addressText: { flex: 1, minWidth: 0 },
  discoveryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ratingBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  googleBadge: { backgroundColor: theme.redesign.container, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gogoBadge: { backgroundColor: theme.redesign.violetSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  // Stitch Search: one inset bottom overlay. Reserve the top 44pt save/verified
  // row; badges wrap within the photo rather than occupying opposing corners.
  photoBadges: { position: 'absolute', left: 12, right: 12, top: 64, bottom: 12, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-end', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  photoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', minWidth: 0, flexShrink: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: theme.redesign.card },
  photoBadgeText: { flexShrink: 1 },
  wrap: { position: 'relative' },

  // --- list (default): the Stitch card, photo over body ---------------------
  listCard: { overflow: 'hidden' },
  listPhoto: { aspectRatio: 1.6, backgroundColor: theme.surface.subtle },
  photoSkeleton: { height: '100%' },
  // `minWidth: 0` lets the text column shrink below its content, which is what
  // makes `numberOfLines={1}` ellipsise instead of pushing the card wider.
  listBody: { minWidth: 0, padding: theme.spacing[4], gap: theme.spacing[2] },
  listHead: { gap: 2, minWidth: 0 },
  // #332: the reason chips share one row at any width. They shrink and
  // ellipsise instead of wrapping — at 375pt two chips took two lines.
  tags: { flexDirection: 'row', gap: 6, minWidth: 0 },
  tagChip: { flexShrink: 1, minWidth: 0, backgroundColor: theme.surface.subtle },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.status.success },
  openLabel: { flexShrink: 1 },

  // --- hero ---------------------------------------------------------------
  heroCard: { height: 260, borderRadius: theme.radius.hero, overflow: 'hidden', justifyContent: 'flex-end' },
  heroScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: overlay.scrim },
  heroBody: { padding: theme.spacing[5], gap: 4 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing[2] },

  // --- save toggle --------------------------------------------------------
  /** On a photo: a solid disc so the glyph reads on any image; 44pt. */
  saveOnPhoto: {
    position: 'absolute',
    top: theme.spacing[3],
    right: theme.spacing[3],
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: touchTarget.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
  },
}))
