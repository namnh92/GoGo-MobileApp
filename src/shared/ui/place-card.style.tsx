import { StyleSheet } from 'react-native-unistyles'

import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  compactCard: { flexDirection: 'row' },
  compactCardPhoto: { width: spacing[9] * 2, minHeight: spacing[9] * 4, backgroundColor: theme.surface.subtle },
  heroPhoto: { height: spacing[9] * 5 + spacing[5], backgroundColor: theme.surface.subtle },
  contributionBadge: { position: 'absolute', top: spacing[3], left: spacing[3], right: spacing[8] + spacing[6], alignItems: 'flex-start' },
  unavailablePhoto: { opacity: 0.5 },
  unavailableName: { textDecorationLine: 'line-through' },
  savedCredits: { paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  savedFooter: { padding: spacing[3], gap: spacing[2], backgroundColor: theme.redesign.card, borderBottomLeftRadius: theme.radius.card, borderBottomRightRadius: theme.radius.card },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], width: '100%' },
  compactPhoto: { width: spacing[9], height: spacing[9], borderRadius: spacing[2] },
  compactCopy: { flex: 1, minWidth: 0, gap: spacing[1] },
  importCard: { borderRadius: spacing[3], overflow: 'hidden', backgroundColor: theme.redesign.card, ...theme.shadows.card },
  importBody: { padding: spacing[4], gap: spacing[3] },
  importFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  importFact: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[2], paddingVertical: spacing[1] / 2, borderRadius: theme.radius.pill, backgroundColor: theme.redesign.container },
  importNoPhotoHead: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing[2] },
  importHeaderAction: { position: 'absolute', top: spacing[2], right: spacing[2] },
  // Reserve 44pt Maps target + 8pt right inset + 8pt gap, even without an action.
  importPhotoOverlays: { position: 'absolute', top: spacing[3], left: spacing[3], right: spacing[9] + spacing[3], alignItems: 'flex-start' },
  importPhotoCredit: { maxWidth: '100%', minWidth: 0, flexShrink: 1, borderRadius: theme.radius.pill, backgroundColor: theme.redesign.scrimStart, paddingHorizontal: spacing[2] + spacing[1] / 2, paddingVertical: spacing[1] },
  importHoursLabel: { flexShrink: 1 },
  importActions: { marginTop: spacing[6], gap: spacing[3] },
  /** Holds the card and, beside it, the save toggle positioned over it. */
  verifiedBadge: { position: 'absolute', top: spacing[3], left: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[1], borderRadius: theme.radius.pill, paddingHorizontal: spacing[2] + spacing[1] / 2, paddingVertical: spacing[1], backgroundColor: theme.redesign.verifiedFill },
  discoveryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] + spacing[1] / 2 },
  discoveryCard: { backgroundColor: theme.redesign.card, borderRadius: theme.radius.card, overflow: 'hidden', ...theme.shadows.card },
  discoveryName: { flex: 1, minWidth: 0 },
  discoveryPrice: { flexShrink: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[1] },
  addressText: { flex: 1, minWidth: 0 },
  discoveryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  photoBadges: { position: 'absolute', left: spacing[3], right: spacing[3], top: spacing[8] + spacing[6], bottom: spacing[3], flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-end', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
  photoBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], maxWidth: '100%', minWidth: 0, flexShrink: 1, paddingHorizontal: spacing[2] + spacing[1] / 2, paddingVertical: spacing[1], borderRadius: theme.radius.pill, backgroundColor: theme.redesign.card },
  openDot: { width: spacing[1] + spacing[1] / 2, height: spacing[1] + spacing[1] / 2, borderRadius: theme.radius.pill, backgroundColor: theme.redesign.greenText },
  photoBadgeText: { flexShrink: 1 },
  listPhoto: { aspectRatio: 1.6, backgroundColor: theme.surface.subtle },
  photoSkeleton: { height: '100%' },
  // `minWidth: 0` lets the text column shrink below its content, which is what
  // makes `numberOfLines={1}` ellipsise instead of pushing the card wider.
  listBody: { minWidth: 0, padding: theme.spacing[4], gap: theme.spacing[2] },
  listHead: { gap: spacing[1] / 2, minWidth: 0 },
  saveOnCompactPhoto: { right: undefined, left: spacing[9] * 2 - touchTarget.min - spacing[3] },
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
