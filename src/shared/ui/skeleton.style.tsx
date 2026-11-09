import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  block: { backgroundColor: theme.surface.subtle },
  photoFrame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.surface.subtle, overflow: 'hidden' },
  photoHighlight: { position: 'absolute', top: 0, bottom: 0, width: '100%' },
  photoFill: { flex: 1 },

  listCard: { overflow: 'hidden' },
  // The pulsing thumb is its own opacity layer, which the card's clip can miss
  // at the corners in light mode: round its top corners itself.
  listThumb: { aspectRatio: 1.6, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  listBody: { padding: spacing[4], gap: spacing[2] },


  detailHero: { height: 260 },
  detailBody: { paddingHorizontal: spacing[5], paddingTop: spacing[5], gap: spacing[3] },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberLines: { flex: 1, gap: spacing[2] },

  planRow: { flexDirection: 'row', gap: spacing[3] },
  planRail: { width: 40, alignItems: 'center', gap: spacing[2] },
  planDot: { width: 36, height: 36, borderRadius: 18 },
  planLine: { width: 2, flex: 1 },
  planCard: { flex: 1, height: 140, borderRadius: radius.card },

  resultHero: { height: 220, borderRadius: radius.hero },

  stack: { gap: spacing[3] },
  screen: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3] },
}))
