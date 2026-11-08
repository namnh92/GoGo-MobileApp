import { StyleSheet } from 'react-native-unistyles'

import { buttonSizes, motion } from '@/shared/ui/tokens'

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
  pill: { borderRadius: 999, gap: 8 },
  area: { borderRadius: 12, borderWidth: 0, backgroundColor: theme.redesign.high, gap: 8 },
  areaPressed: { backgroundColor: theme.redesign.container },
  areaPrimary: { backgroundColor: theme.accent.primary, borderColor: 'transparent' },
  discoveryJoin: { borderRadius: 12, gap: 4, borderWidth: 0, backgroundColor: theme.redesign.high },
  // Reserve the same border space for filled and outlined discovery CTAs.
  discovery: { borderRadius: 999, gap: 4, borderWidth: 1 },
  discoveryPrimary: { backgroundColor: theme.accent.primary, borderColor: 'transparent' },
  stitch: { borderRadius: 12, gap: 4 },
  stitchSubtle: { borderRadius: 12, gap: 4 },
  stitchGuest: { borderRadius: 12 },
  stitchSkip: { borderRadius: 999 },
  stitchSkipPill: { borderRadius: 999, backgroundColor: theme.redesign.low },
  stitchPressed: { transform: [{ scale: motion.pressScale }] },
  stitchPressedSubtle: { transform: [{ scale: motion.pressScaleSubtle }] },
  base: {
    borderRadius: theme.radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
  },
  regular: { minWidth: buttonSizes.regular.minHeight, minHeight: buttonSizes.regular.minHeight, paddingHorizontal: buttonSizes.regular.paddingHorizontal, paddingVertical: buttonSizes.regular.paddingVertical },
  small: { minWidth: buttonSizes.small.minHeight, minHeight: buttonSizes.small.minHeight, paddingHorizontal: buttonSizes.small.paddingHorizontal, paddingVertical: buttonSizes.small.paddingVertical },
  label: { flexShrink: 1, textAlign: 'center' },

  primary: { backgroundColor: theme.accent.primary, ...theme.shadows.cta },
  primaryPressed: { backgroundColor: theme.accent.pressed, ...noShadow },
  primaryDisabled: { backgroundColor: theme.surface.subtle, ...noShadow },
  primaryOnAccent: { backgroundColor: theme.accent.onAccent, ...noShadow },
  primaryOnAccentPressed: { backgroundColor: theme.accent.soft },

  secondary: {
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  secondaryPressed: { backgroundColor: theme.accent.soft },
  secondaryDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },
  secondaryOnAccent: { backgroundColor: 'transparent', borderColor: theme.accent.onAccent },
  secondaryOnAccentPressed: { backgroundColor: theme.onDark.wash },

  neutral: { borderRadius: 16, backgroundColor: theme.surface.subtle, borderWidth: 0, ...noShadow },
  neutralPressed: { backgroundColor: theme.surface.card },

  ghost: {},
  ghostPressed: { backgroundColor: theme.surface.subtle },
  ghostDisabled: {},

  danger: {
    backgroundColor: theme.status.dangerSoft,
    borderWidth: 0,
  },
  dangerPressed: { backgroundColor: theme.surface.subtle },
  dangerDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },

  /** A coloured ground has no neutral disabled fill; fade instead. */
  onAccentInactive: { opacity: 0.6 },

  icon: {
    borderRadius: buttonSizes.small.minHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  iconRegular: { width: buttonSizes.regular.minHeight, height: buttonSizes.regular.minHeight, borderRadius: buttonSizes.regular.minHeight / 2 },
  iconSmall: { width: buttonSizes.small.minHeight, height: buttonSizes.small.minHeight },
  iconActive: { backgroundColor: theme.accent.soft, borderColor: theme.accent.primary },
  iconPressed: { backgroundColor: theme.surface.subtle },
  iconDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },
}))
