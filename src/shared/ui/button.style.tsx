import { StyleSheet } from 'react-native-unistyles'

import { motion, touchTarget } from '@/shared/ui/tokens'

/**
 * The default button family (#293 §2). Pressed is a colour change —
 * no scale, no opacity — so a press never moves the layout and every button
 * answers a finger the same way. Disabled is a fill change, not a fade, so the
 * label keeps a colour that was measured (`text.secondary` on `surface.subtle`).
 *
 * Owner 2026-11-06 D1 adds tokenized scale to the Stitch variants only.
 * Another exception is `onAccent`: a button sitting on an accent-coloured hero
 * has no neutral fill that still reads as "part of this surface", so its
 * disabled state fades instead.
 */
const noShadow = { shadowOpacity: 0, elevation: 0 } as const

export const styles = StyleSheet.create(theme => ({
  area: { minHeight: 50, height: undefined, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border.hairline, backgroundColor: theme.redesign.high, gap: 8 },
  areaPressed: { backgroundColor: theme.redesign.container },
  areaPrimary: { backgroundColor: theme.redesign.primaryFill, borderColor: 'transparent' },
  discoveryJoin: { minHeight: 48, height: undefined, paddingVertical: 12, borderRadius: 12, gap: 4, borderWidth: 0, backgroundColor: theme.redesign.high },
  // Reserve the same border space for filled and outlined discovery CTAs.
  discovery: { minHeight: 48, height: undefined, paddingVertical: 12, borderRadius: 999, gap: 4, borderWidth: 1 },
  discoveryPrimary: { backgroundColor: theme.redesign.primaryFill, borderColor: 'transparent' },
  stitch: { minHeight: 48, height: undefined, paddingVertical: 13, borderRadius: 12, gap: 4 },
  stitchSubtle: { minHeight: 48, height: undefined, paddingVertical: 13, borderRadius: 12, gap: 4 },
  stitchGuest: { minHeight: 44, height: undefined, borderRadius: 12 },
  stitchSkip: { minHeight: 44, height: undefined, paddingHorizontal: 12, borderRadius: 999 },
  stitchSkipPill: { minHeight: 44, height: undefined, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.redesign.low },
  stitchPressed: { transform: [{ scale: motion.pressScale }] },
  stitchPressedSubtle: { transform: [{ scale: motion.pressScaleSubtle }] },
  base: {
    borderRadius: theme.radius.button,
    paddingHorizontal: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  label: { flexShrink: 1, textAlign: 'center' },

  primary: { height: 56, backgroundColor: theme.accent.primary, ...theme.shadows.cta },
  primaryPressed: { backgroundColor: theme.accent.pressed, ...noShadow },
  primaryDisabled: { backgroundColor: theme.surface.subtle, ...noShadow },
  primaryOnAccent: { backgroundColor: theme.accent.onAccent, ...noShadow },
  primaryOnAccentPressed: { backgroundColor: theme.accent.soft },

  secondary: {
    height: 52,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  secondaryPressed: { backgroundColor: theme.accent.soft },
  secondaryDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },
  secondaryOnAccent: { backgroundColor: 'transparent', borderColor: theme.accent.onAccent },
  secondaryOnAccentPressed: { backgroundColor: theme.onDark.wash },

  ghost: { height: touchTarget.min },
  ghostPressed: { backgroundColor: theme.surface.subtle },
  ghostDisabled: {},

  danger: {
    height: 52,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.status.danger,
  },
  dangerPressed: { backgroundColor: theme.status.dangerSoft },
  dangerDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },

  /** A coloured ground has no neutral disabled fill; fade instead. */
  onAccentInactive: { opacity: 0.6 },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  iconActive: { backgroundColor: theme.accent.soft, borderColor: theme.accent.primary },
  iconPressed: { backgroundColor: theme.surface.subtle },
  iconDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },
}))
