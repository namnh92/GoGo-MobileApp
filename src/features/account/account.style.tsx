import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay, radius, shadows, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[4], marginTop: spacing[4], gap: spacing[3], borderRadius: 16, ...shadows.stitch },
  sectionMark: { width: 6, height: 16, borderRadius: 3, backgroundColor: theme.accent.primary },
  neutralMark: { backgroundColor: theme.text.secondary },
  dangerMark: { backgroundColor: theme.status.danger },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[3], borderRadius: 12, borderWidth: 1, borderColor: theme.redesign.outline, backgroundColor: theme.surface.subtle },
  emailValue: { flex: 1 },
  avatarBlock: { paddingTop: spacing[5], paddingBottom: spacing[2], alignItems: 'center', gap: spacing[1] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: {
    ...type.accountInput,
    // A line height on a single-line field makes iOS wrap a long value; the fixed height centres it.
    lineHeight: undefined,
    height: touchTarget.min,
    borderWidth: 1, borderColor: theme.redesign.outline,
    borderRadius: 12,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.surface.subtle,
  },
  pressed: { backgroundColor: theme.accent.pressed },
  disabled: { opacity: 0.4 },
  avatarEdit: {
    position: 'absolute', right: 0, bottom: 0,
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPhoto: { borderRadius: 52, borderWidth: 4, borderColor: theme.surface.card },
  avatarEditBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.surface.canvas },
  deletePressed: { backgroundColor: theme.surface.subtle },
  deleteBtn: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: theme.status.danger,
    backgroundColor: theme.surface.card,
  },
  notice: { textAlign: 'center', marginTop: spacing[4] },

  /** ADR-0022 — the avatar block: picture, what it is for, change / remove. */
  avatarRow: { alignItems: 'center', gap: spacing[3] },
  avatarWrap: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  avatarOverlay: {
    ...fill,
    borderRadius: 48,
    backgroundColor: overlay.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { alignItems: 'center', gap: spacing[1] },
  avatarCaption: { textAlign: 'center' },
  avatarActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
}))
