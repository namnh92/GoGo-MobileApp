import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget } from '@/shared/ui/tokens'

// Pressed is a colour change only (#382).

export const styles = StyleSheet.create(theme => ({
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
  bellBadge: { position: 'absolute', top: -5, right: -5 },
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
    // Solid, like every field (#382): a glass wash belongs to bars only.
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    paddingHorizontal: spacing[4],
  },

  hero: {
    marginHorizontal: spacing[5],
    padding: spacing[5],
    borderRadius: radius.hero,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
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
    flex: 1,
    height: touchTarget.min + 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primary,
  },
  heroPrimaryPressed: { backgroundColor: theme.accent.pressed },
  heroSecondary: {
    height: touchTarget.min + 4,
    paddingHorizontal: spacing[5],
    borderRadius: radius.pill,
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
