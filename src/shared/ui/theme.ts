import {
  accents,
  border,
  glass,
  night,
  onDark,
  radius,
  shadows,
  spacing,
  status,
  surface,
  text,
  type,
  type AccentName,
} from '@/shared/ui/tokens'

/**
 * The four Unistyles themes (#293 §6, ADR-0009). A theme is the fixed roles
 * from `tokens.ts` plus one accent palette; only `accent` (and the CTA shadow
 * that borrows its colour) differs between them. Screens migrate to
 * `StyleSheet.create(theme => …)` and read `theme.accent.primary` where they
 * used to read `colors.brand.coral`.
 *
 * Plain TypeScript, like `tokens.ts`: vitest imports this file, and the
 * Unistyles registration lives in `unistyles.ts`.
 */

/** Theme keys are taxonomy keys: persisted as-is, labelled through i18n. */
export const ACCENTS = ['orange', 'green', 'blue', 'purple'] as const satisfies readonly AccentName[]

export type Accent = (typeof ACCENTS)[number]

/** Closest to the coral the app shipped with, so an unchanged user sees no change. */
export const DEFAULT_ACCENT: Accent = 'orange'

function buildTheme(accent: Accent) {
  const palette = accents[accent]
  return {
    accent: palette,
    surface,
    border,
    text,
    status,
    onDark,
    night,
    type,
    spacing,
    radius,
    shadows: {
      card: shadows.card,
      toast: shadows.toast,
      cta: { ...shadows.cta, shadowColor: palette.primary },
    },
    glass: { bar: glass.bar },
  }
}

export type AppTheme = ReturnType<typeof buildTheme>

export const themes = {
  orange: buildTheme('orange'),
  green: buildTheme('green'),
  blue: buildTheme('blue'),
  purple: buildTheme('purple'),
} satisfies Record<Accent, AppTheme>
