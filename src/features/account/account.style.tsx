import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  input: {
    ...type.body,
    // A line height on a single-line field makes iOS wrap a long value; the fixed height centres it.
    lineHeight: undefined,
    height: touchTarget.min,
    borderRadius: radius.compact,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.surface.subtle,
  },
  saveBtn: { marginTop: spacing[2] },
  /** The destructive section reads as one: tinted ground, danger heading, danger button. */
  dangerCard: { backgroundColor: theme.status.dangerSoft },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
  },
  deleteBtn: {
    minHeight: 52,
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
  avatarWrap: { width: 80, height: 80 },
  avatarOverlay: {
    ...fill,
    borderRadius: 40,
    backgroundColor: overlay.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { alignItems: 'center', gap: spacing[1] },
  avatarCaption: { textAlign: 'center' },
  avatarActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  avatarChangeBtn: { flex: 1 },
}))
