import { StyleSheet } from 'react-native'

import { radius, spacing, surface } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  block: { backgroundColor: surface.subtle },

  listCard: { flexDirection: 'row', gap: spacing[3] },
  listThumb: { width: 96 },
  listBody: { flex: 1, gap: spacing[2], justifyContent: 'center' },

  gridCard: { borderRadius: radius.card, overflow: 'hidden' },
  gridThumb: { height: 120 },
  gridBody: { padding: spacing[3], gap: spacing[2] },

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
})
