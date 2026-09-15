import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: brand.coral },
  live: { ...type.caption, fontWeight: '700', color: brand.coral, letterSpacing: 0.5 },
  stopCounter: { ...type.title1, color: neutral[900] },

  /** Dots repeat the counter visually, so they stay decorative. */
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: { height: 6, width: 14, borderRadius: 3, backgroundColor: neutral[100] },
  stepDotActive: { width: 24, backgroundColor: brand.coral },
  stepDotDone: { backgroundColor: brand.mint },

  // The current stop is the screen. Everything else is context around it.
  card: { overflow: 'hidden', marginBottom: spacing[4] },
  cardImage: { width: '100%', height: 220 },
  cardBody: { padding: spacing[5] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  name: { ...type.display, color: neutral[900] },
  area: { ...type.body, color: neutral[500], marginTop: 4 },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },

  mapThumb: {
    marginTop: spacing[4],
    height: 140,
    borderRadius: radius.compact,
    overflow: 'hidden',
    backgroundColor: brand.mintSoft,
  },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  mapFallbackLabel: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },

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
  dirLabel: { ...type.body, fontWeight: '700', color: neutral[900] },

  nextCard: {
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min + 20,
  },
  nextCaption: { ...type.caption, color: neutral[500], fontWeight: '700', letterSpacing: 0.5 },
  nextName: { ...type.title2, color: neutral[900], marginTop: 2 },
  nextMeta: { ...type.bodySmall, color: neutral[500], marginTop: 2 },

  failure: { ...type.bodySmall, color: brand.red, marginTop: spacing[3], textAlign: 'center' },
  notActive: { alignItems: 'center', gap: spacing[2] },
})
