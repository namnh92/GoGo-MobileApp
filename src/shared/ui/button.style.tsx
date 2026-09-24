import { StyleSheet } from 'react-native-unistyles'

import { glassFx, touchTarget } from '@/shared/ui/tokens'

/**
 * The button family (#293 §2). Pressed is a colour change and nothing else —
 * no scale, no opacity — so a press never moves the layout and every button
 * answers a finger the same way. Disabled is a fill change, not a fade, so the
 * label keeps a colour that was measured (`text.secondary` on `surface.subtle`).
 *
 * The one exception is `onAccent`: a button sitting on an accent-coloured hero
 * has no neutral fill that still reads as "part of this surface", so its
 * disabled state fades instead.
 */
const noShadow = { shadowOpacity: 0, elevation: 0 } as const

export const styles = StyleSheet.create(theme => ({
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
  secondaryOnAccentPressed: { backgroundColor: glassFx.badge },

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
