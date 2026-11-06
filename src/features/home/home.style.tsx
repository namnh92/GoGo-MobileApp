import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

// Pressed is a colour change only (#382).

export const styles = StyleSheet.create(theme => ({
  moodSection: { marginTop: 24, gap: 8 },
  moodHeading: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  moods: { paddingHorizontal: 16, gap: 8 },
  roomIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.redesign.violet, alignItems: 'center', justifyContent: 'center' },
  roomAction: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: theme.redesign.violet, alignItems: 'center', justifyContent: 'center' },
  nearestRoom: { marginHorizontal: 16, marginTop: 24, padding: 16, gap: 12, flexDirection: 'row', alignItems: 'center', minHeight: 72, borderRadius: 16, backgroundColor: theme.redesign.violetSoft },
  roomCopy: { flex: 1, gap: 4 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 64, backgroundColor: theme.redesign.canvas },
  brand: { width: 32, height: 32, borderRadius: 12, backgroundColor: theme.redesign.primaryFill, justifyContent: 'center', alignItems: 'center' },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 },
  join: { marginHorizontal: 16, marginTop: 24, backgroundColor: theme.redesign.card, borderRadius: 16, padding: 12, gap: 8 },
  joinHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinInput: { ...type.introBody, color: theme.redesign.ink, flex: 1, minHeight: 48, minWidth: 0, backgroundColor: theme.redesign.container, borderRadius: 12, paddingHorizontal: 12 },
  joinButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.redesign.high, borderWidth: 0 },
  bell: {
    width: 44,
    height: 44,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  bellBadge: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: theme.redesign.primaryFill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    marginTop: 24,
    borderRadius: radius.hero,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.accent.soft,
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing[3],
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
    backgroundColor: theme.redesign.primary,
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
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
