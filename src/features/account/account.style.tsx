import { StyleSheet } from 'react-native-unistyles'

import { colors, fill, overlay, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  input: {
    ...type.body,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  saveBtn: { marginTop: spacing[2] },
  deleteBtn: {
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: brand.red,
  },
  notice: { textAlign: 'center', marginTop: spacing[4] },

  /** ADR-0022 — the avatar block: picture, what it is for, change / remove. */
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  avatarWrap: { width: 80, height: 80 },
  avatarOverlay: {
    ...fill,
    borderRadius: 40,
    backgroundColor: overlay.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { flex: 1, gap: spacing[1] },
  avatarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  avatarChangeBtn: { flex: 1 },
})
