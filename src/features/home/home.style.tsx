import { StyleSheet } from 'react-native-unistyles'

import { fill, glassFx, overlay, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  subtitle: { marginTop: 2 },

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

  hero: {
    marginHorizontal: spacing[5],
    height: 252,
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  heroScrim: {
    ...fill,
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
  heroBody: { marginTop: 4, marginBottom: spacing[4] },

  // One dominant CTA (spec §7): "Tạo kèo" is filled, "Chọn nhanh" is outlined.
  heroActions: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  heroPrimary: {
    flex: 1,
    height: touchTarget.min + 4,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primary,
    shadowColor: theme.accent.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  heroSecondary: {
    height: touchTarget.min + 4,
    paddingHorizontal: spacing[5],
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: glassFx.borderLight,
  },

  presetRow: { paddingHorizontal: spacing[5], gap: spacing[2] },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },

  stateCard: { padding: spacing[6], alignItems: 'center' },
  stateEmoji: { marginBottom: spacing[3] },
  stateTitle: { textAlign: 'center' },
  stateBody: { marginTop: 4, textAlign: 'center' },
  stateActions: { alignSelf: 'stretch', gap: spacing[2], marginTop: spacing[5] },
  /** ADM-204 — which location scoped the suggestions, said in words. */
  scopeLabel: { marginBottom: spacing[3] },
  scopeCard: { padding: spacing[4], marginBottom: spacing[4], gap: spacing[2] },
}))
