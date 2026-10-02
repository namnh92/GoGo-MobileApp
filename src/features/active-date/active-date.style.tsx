import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create(theme => ({
  topBar: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.primary },
  live: { letterSpacing: 0.5 },

  /** Dots repeat the counter visually, so they stay decorative. */
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: { height: 6, width: 14, borderRadius: 3, backgroundColor: neutral[100] },
  stepDotActive: { width: 24, backgroundColor: theme.accent.primary },
  stepDotDone: { backgroundColor: brand.mint },

  // The current stop is the screen. Everything else is context around it.
  card: { overflow: 'hidden', marginBottom: spacing[4] },
  cardImage: { width: '100%', height: 220 },
  cardBody: { padding: spacing[5] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  area: { marginTop: 4 },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },

  mapThumb: {
    marginTop: spacing[4],
    height: 140,
    borderRadius: radius.compact,
    overflow: 'hidden',
    backgroundColor: brand.mintSoft,
  },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  mapFallbackLabel: { textAlign: 'center' },

  // "Xong bước này" is the dominant action; directions support it.
  actions: { gap: spacing[2], marginTop: spacing[4] },
  dirBtn: {
    height: touchTarget.min + 4,
    borderRadius: radius.button,
    backgroundColor: neutral[50],
    borderWidth: 1,
    borderColor: neutral[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  nextCard: {
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min + 20,
  },
  nextCaption: { letterSpacing: 0.5 },
  nextName: { marginTop: 2 },
  nextMeta: { marginTop: 2 },

  failure: { marginTop: spacing[3], textAlign: 'center' },
  /** #251 — the room is not live: one message and one way out. */
  notActive: { flex: 1, paddingHorizontal: spacing[5] },
  notActiveCta: { alignSelf: 'stretch', marginTop: spacing[4] },
  /** The room notice inside the padded not-active column (#292). */
  notice: { marginHorizontal: 0 },
}))
