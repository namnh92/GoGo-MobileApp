import { StyleSheet } from 'react-native'
import { colors, glyph, radius, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[4],
  },
  card: {
    borderRadius: radius.hero,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    alignSelf: 'stretch',
  },
  emoji: { fontSize: glyph.xl },
  title: { ...type.title1, color: neutral[900], textAlign: 'center' },
  body: { ...type.body, color: neutral[500], textAlign: 'center' },
  hint: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing[3], marginTop: spacing[2] },
  badge: {
    backgroundColor: brand.coralGhost,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeLabel: { ...type.caption, color: brand.coral },
})
