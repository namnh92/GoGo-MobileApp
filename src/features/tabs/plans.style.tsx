import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: {
    ...type.display,
    color: neutral[900],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  caption: {
    ...type.caption,
    fontWeight: '700',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing[4],
    marginBottom: spacing[3],
  },

  card: {
    padding: spacing[4],
    marginBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: touchTarget.min + 24,
  },
  /** Past rooms are still readable, just clearly behind the live ones. */
  cardPast: { opacity: 0.72 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.compact,
    backgroundColor: brand.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPast: { backgroundColor: neutral[100] },
  cardTitle: { ...type.title2, color: neutral[900] },
  cardMeta: { ...type.bodySmall, color: neutral[500], marginTop: 2 },
  cardFacts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  fact: { ...type.caption, color: neutral[500] },
  deviceOnlyNote: { ...type.caption, color: neutral[500], marginTop: spacing[5], lineHeight: 17 },
})
