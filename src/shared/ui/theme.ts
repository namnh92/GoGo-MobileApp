import {
  accents,
  workspace,
  border,
  darkAccents,
  darkBorder,
  darkGlass,
  darkMapColors,
  darkStatus,
  darkSurface,
  darkText,
  glass,
  mapColors,
  night,
  overlay,
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

/** Stitch default orange. The persisted accent key is unchanged. */
export const DEFAULT_ACCENT: Accent = 'orange'

/** The device's appearance. There is no in-app switch: the setting is the device's. */
export type Mode = 'light' | 'dark'

/**
 * Unistyles theme name for an accent in a mode. Light keeps the bare accent key
 * (what the app, the saved preference and every test already call a theme);
 * dark appends `Dark`, so the accent key and the mode stay separable.
 */
export type ThemeName = Accent | `${Accent}Dark`

export function themeName(accent: Accent, mode: Mode): ThemeName {
  return mode === 'dark' ? `${accent}Dark` : accent
}

/** Inverse of `themeName`'s accent half; `undefined` for anything that is not a theme name. */
export function accentOf(name: unknown): Accent | undefined {
  if (typeof name !== 'string') return undefined
  const bare = name.endsWith('Dark') ? name.slice(0, -4) : name
  return (ACCENTS as readonly string[]).includes(bare) ? (bare as Accent) : undefined
}

export function modeOf(scheme: string | null | undefined): Mode {
  return scheme === 'dark' ? 'dark' : 'light'
}

function buildTheme(accent: Accent, mode: Mode) {
  const dark = mode === 'dark'
  const palette = (dark ? darkAccents : accents)[accent]
  const material = dark ? darkGlass : glass
  return {
    mode,
    accent: palette,
    surface: dark ? darkSurface : surface,
    border: dark ? darkBorder : border,
    text: dark ? darkText : text,
    status: dark ? darkStatus : status,
    map: dark ? darkMapColors : mapColors,
    onDark,
    overlay,
    workspace,
    night,
    type,
    spacing,
    radius,
    shadows: {
      card: shadows.card,
      toast: shadows.toast,
      cta: { ...shadows.cta, shadowColor: palette.primary },
    },
    glass: { bar: material.bar, opaque: material.opaque, translucent: material.translucent, header: material.header },
  }
}

export type AppTheme = ReturnType<typeof buildTheme>

export const themes = {
  orange: buildTheme('orange', 'light'),
  green: buildTheme('green', 'light'),
  blue: buildTheme('blue', 'light'),
  purple: buildTheme('purple', 'light'),
  orangeDark: buildTheme('orange', 'dark'),
  greenDark: buildTheme('green', 'dark'),
  blueDark: buildTheme('blue', 'dark'),
  purpleDark: buildTheme('purple', 'dark'),
} satisfies Record<ThemeName, AppTheme>
