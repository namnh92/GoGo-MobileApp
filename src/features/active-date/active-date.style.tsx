import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  // Progress card: where the date is, in one glance.
  stopSummary: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[3] },
  progressCard: { padding: spacing[4], gap: spacing[2] },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.primary },
  live: { letterSpacing: 0.5 },

  /** Segments repeat the counter visually, so they stay decorative. */
  stepDots: { flexDirection: 'row', gap: spacing[1], marginTop: spacing[1] },
  stepDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.surface.subtle },
  stepDotActive: { backgroundColor: theme.accent.primary },
  stepDotDone: { backgroundColor: theme.status.success },

  // The current stop is the screen. Everything else is context around it.
  card: { overflow: 'hidden', marginBottom: spacing[5] },
  photo: { width: '100%', height: 192 },
  cardImage: { width: '100%', height: '100%' },
  photoBadge: { position: 'absolute', top: spacing[3], left: spacing[3] },
  cardBody: { padding: spacing[5], gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  titleText: { flex: 1 },
  area: { marginTop: spacing[1] },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: chipRowGap },

  mapThumb: {
    height: 140,
    borderRadius: radius.compact,
    overflow: 'hidden',
    backgroundColor: theme.surface.subtle,
  },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  mapFallbackLabel: { textAlign: 'center' },

  /** Round directions button beside the name; supports the dominant action below. */
  dirBtn: {
    width: touchTarget.min + 4,
    height: touchTarget.min + 4,
    borderRadius: radius.pill,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Pressed is a colour change only (#382). */
  dirBtnPressed: { backgroundColor: theme.surface.subtle },

  sectionHeader: { paddingHorizontal: spacing[1], marginBottom: spacing[2] },
  sectionLabel: { letterSpacing: 0.5, textTransform: 'uppercase' },
  nextCard: {
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min + 20,
  },
  nextThumb: { width: 80, height: 80, borderRadius: radius.compact, overflow: 'hidden' },
  nextName: { marginTop: 2 },
  nextMeta: { marginTop: 2 },

  failure: { marginBottom: spacing[3], textAlign: 'center' },
  /** #251 — the room is not live: one message and one way out. */
  notActive: { flex: 1, paddingHorizontal: spacing[5] },
  notActiveCta: { alignSelf: 'stretch', marginTop: spacing[4] },
  /** The room notice inside the padded not-active column (#292). */
  notice: { marginHorizontal: 0 },
}))
