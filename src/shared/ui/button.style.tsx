import { StyleSheet } from 'react-native-unistyles'

import { buttonSizes, motion } from '@/shared/ui/tokens'

/**
 * Pressing keeps the resting fill/tint (owner 2026-11-08). Existing shadow
 * feedback and tokenized Stitch scale remain unchanged. Disabled is a fill
 * change, not a fade, so the label keeps its measured contrast.
 *
 * Another exception is `onAccent`: a button sitting on an accent-coloured hero
 * has no neutral fill that still reads as "part of this surface", so its
 * disabled state fades instead.
 */
const noShadow = { shadowOpacity: 0, elevation: 0 } as const

export const styles = StyleSheet.create(theme => ({
  pill: { borderRadius: 999, gap: 8 },
  area: { borderRadius: 12, borderWidth: 0, backgroundColor: theme.redesign.high, gap: 8 },
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
  primaryPressed: { ...noShadow },
  primaryDisabled: { backgroundColor: theme.surface.subtle, ...noShadow },
  primaryOnAccent: { backgroundColor: theme.accent.onAccent, ...noShadow },

  secondary: {
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  secondaryDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },
  secondaryOnAccent: { backgroundColor: 'transparent', borderColor: theme.accent.onAccent },

  neutral: { borderRadius: 16, backgroundColor: theme.surface.subtle, borderWidth: 0, ...noShadow },
  neutralPill: { borderRadius: 999, backgroundColor: theme.redesign.high, gap: 4 },

  ghost: {},
  ghostDisabled: {},

  danger: {
    backgroundColor: theme.status.dangerSoft,
    borderWidth: 0,
  },
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
  iconDisabled: { backgroundColor: theme.surface.subtle, borderColor: 'transparent' },
}))
