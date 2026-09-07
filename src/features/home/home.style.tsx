import { StyleSheet } from 'react-native'

import { colors, glassFx, glyph, onDark, overlay, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  greeting: { ...type.display, color: neutral[900] },
  subtitle: { ...type.body, color: neutral[500], marginTop: 2 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    height: touchTarget.min + 4,
    borderRadius: radius.compact,
    backgroundColor: glassFx.chip,
    borderWidth: 1,
    borderColor: glassFx.borderLight,
    paddingHorizontal: spacing[4],
  },
  searchBarLabel: { ...type.body, color: neutral[500] },

  hero: {
    marginHorizontal: spacing[5],
    height: 252,
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: overlay.scrim,
  },
  heroContent: {
    flex: 1,
    padding: spacing[5],
    justifyContent: 'flex-end',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: glassFx.badge,
    borderWidth: 1,
    borderColor: glassFx.btnBorder,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing[3],
  },
  heroBadgeLabel: { ...type.caption, color: neutral[0], fontWeight: '700' },
  heroTitle: { ...type.title1, color: neutral[0] },
  heroBody: { ...type.bodySmall, color: onDark.medium, marginTop: 4, marginBottom: spacing[4] },

  // One dominant CTA (spec §7): "Tạo kèo" is filled, "Chọn nhanh" is outlined.
  heroActions: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  heroPrimary: {
    flex: 1,
    height: touchTarget.min + 4,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.coral,
    shadowColor: brand.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  heroPrimaryLabel: { ...type.body, color: neutral[0], fontWeight: '700' },
  heroSecondary: {
    height: touchTarget.min + 4,
    paddingHorizontal: spacing[5],
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: glassFx.borderLight,
  },
  heroSecondaryLabel: { ...type.body, color: neutral[0], fontWeight: '600' },

  presetRow: { paddingHorizontal: spacing[5], gap: spacing[2] },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  sectionTitle: { ...type.title2, color: neutral[900] },
  sectionHint: { ...type.bodySmall, color: neutral[500] },

  stateCard: { padding: spacing[6], alignItems: 'center' },
  stateEmoji: { fontSize: glyph.xl, marginBottom: spacing[3] },
  stateTitle: { ...type.title2, color: neutral[900], textAlign: 'center' },
  stateBody: { ...type.bodySmall, color: neutral[500], marginTop: 4, textAlign: 'center', lineHeight: 19 },
  stateActions: { alignSelf: 'stretch', gap: spacing[2], marginTop: spacing[5] },
})
