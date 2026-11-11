import { StyleSheet } from 'react-native-unistyles'

import { chipRowGap, radius, spacing, tabRootSpacing, touchTarget, type } from '@/shared/ui/tokens'

// Home discovery surfaces follow the approved Stitch design.

export const styles = StyleSheet.create(theme => ({
  suggestions: { paddingHorizontal: spacing[4], marginTop: tabRootSpacing.section },
  moreAction: { minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  moods: { gap: chipRowGap, paddingVertical: spacing[1], marginBottom: spacing[3] },
  roomIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface.card, alignItems: 'center', justifyContent: 'center' },
  roomStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  roomDot: { width: spacing[1], height: spacing[1], borderRadius: radius.pill, backgroundColor: theme.status.infoText },
  roomAction: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: theme.status.info, alignItems: 'center', justifyContent: 'center' },
  nearestRoom: { marginHorizontal: 16, marginTop: tabRootSpacing.section, padding: 16, gap: 12, flexDirection: 'row', alignItems: 'center', minHeight: 72, borderRadius: 16, backgroundColor: theme.status.infoSoft },
  roomCopy: { flex: 1, gap: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 },
  join: { marginHorizontal: 16, marginTop: tabRootSpacing.section, backgroundColor: theme.surface.card, borderRadius: 16, padding: 12, gap: 8 },
  joinHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinInput: { ...type.introBody, color: theme.text.primary, flex: 1, minHeight: 48, minWidth: 0, backgroundColor: theme.surface.container, borderRadius: 12, paddingHorizontal: 12 },
  joinButton: { borderRadius: 12, backgroundColor: theme.surface.high, borderWidth: 0 },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    // Solid, like every field (#382): a glass wash belongs to bars only.
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    paddingHorizontal: spacing[4],
  },

  heroDecor: { position: 'absolute', right: -12, bottom: -12, opacity: 0.25 },
  hero: {
    marginHorizontal: 16,
    padding: 16,
    marginTop: tabRootSpacing.section,
    borderRadius: radius.hero,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  heroBody: { marginTop: 4, marginBottom: spacing[4] },

  // One dominant CTA (spec §7): "Tạo kèo" is filled, "Chọn nhanh" is a quiet fill.
  heroActions: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  heroPrimary: {
    alignSelf: 'flex-start',
    paddingHorizontal: 24,
    height: touchTarget.min + 4,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primaryDeep,
  },
  heroPrimaryPressed: { backgroundColor: theme.accent.pressed },
  heroSecondary: {
    height: touchTarget.min + 4,
    paddingHorizontal: spacing[5],
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
  },
  heroSecondaryPressed: { backgroundColor: theme.accent.soft },

  presetRow: { paddingHorizontal: spacing[5], gap: spacing[2] },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tabRootSpacing.headingContent,
  },

  stateCard: { padding: spacing[6], alignItems: 'center' },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
    marginBottom: spacing[3],
  },
  stateTitle: { textAlign: 'center' },
  stateBody: { marginTop: 4, textAlign: 'center' },
  stateActions: { alignSelf: 'stretch', gap: spacing[2], marginTop: spacing[5] },
  /** ADM-204 — which location scoped the suggestions, said in words. */
  scopeLabel: { marginBottom: spacing[3] },
  scopeCard: { padding: spacing[4], marginBottom: spacing[4], gap: spacing[2] },
}))
