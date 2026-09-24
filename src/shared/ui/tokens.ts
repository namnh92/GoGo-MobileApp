// Warm Liquid Glass design tokens — single source of truth for the mobile app.
// Values come from GOGO_FEATURE_IMPROVEMENT_SPEC.md §42–§49 and the Figma
// "Foundations" page (GoGo-MobileApp#293 §1); keep in sync with the shared
// design-tokens package once it is published (FND-003/FND-009).
//
// This file is plain TypeScript on purpose: vitest imports it, and so does
// `theme.ts`, which turns these static roles plus an accent palette into the
// four Unistyles themes. Nothing here may import `react-native-unistyles`.

export const colors = {
  brand: {
    coral: '#D84F4A',
    /**
     * Primary CTA gradient (spec §45.2). It used to run `coral → coralDeep`, so
     * its lightest end put white on 4.09:1 — under AA for a 15px label. Both
     * ends are now dark enough for white text: 4.77 and 5.46. `coral` itself is
     * unchanged and stays the brand accent on light surfaces.
     */
    coralDeep: '#C74552',
    coralInk: '#B93E48',
    coralBright: '#FF746C',
    coralSoft: '#FFD8D4',
    /** Faint coral wash for badges on light surfaces. */
    coralGhost: 'rgba(216,79,74,0.1)',
    lavender: '#7667E8',
    lavenderSoft: '#E5E0FF',
    /** Translucent lavender for CTAs sitting on photos. */
    lavenderGlass: 'rgba(118,103,232,0.78)',
    mint: '#4FAF86',
    mintSoft: '#D9F3E7',
    amber: '#D99028',
    amberSoft: '#FCEBCB',
    red: '#C84455',
    redSoft: '#FADDE2',
  },
  neutral: {
    0: '#FFFFFF',
    25: '#FCFBF8',
    50: '#F6F3EE',
    100: '#ECE8E1',
    /** Lines, borders and disabled fills. Never text: 1.78:1 on white. */
    300: '#C8C1B8',
    /**
     * Secondary text. Was #817B74, which measured 4.18:1 on white and 3.78:1 on
     * the ivory app background — under WCAG 2.2 AA for body text, on the colour
     * carrying most of the metadata in the product. This one is 5.03 and 4.55.
     * Figma Foundations still says #817B74; owner decision 2026-09-24 keeps this.
     */
    500: '#746E68',
    700: '#4A4641',
    900: '#211F1C',
  },
} as const

// ---------------------------------------------------------------------------
// Semantic roles (#293 §1). Fixed — they do not change with the accent theme.
// Components read these, never `colors.*` directly, so a palette change is one
// edit here rather than a grep across screens.
// ---------------------------------------------------------------------------

/** Backgrounds, from the screen canvas up to a card. */
export const surface = {
  canvas: colors.neutral[50],
  card: colors.neutral[0],
  /** Tracks, skeletons, disabled fills, image placeholders. */
  subtle: colors.neutral[100],
} as const

export const border = {
  /** List-row dividers, the top edge of a glass bar. */
  hairline: colors.neutral[100],
} as const

/** Text colours on light surfaces. `tertiary` is placeholder-only: 1.6:1. */
export const text = {
  primary: colors.neutral[900],
  secondary: colors.neutral[500],
  tertiary: colors.neutral[300],
} as const

/**
 * Status colours. The base colour is a fill or a dot; `*Soft` is its pill
 * background; `*Text` is the only one of the three allowed to carry a label on
 * a light surface — the base values measure 2.4–2.7:1 on white for success and
 * warning, and no amount of weight makes that readable. `*Text` values are the
 * base hue darkened until white and ivory both clear 4.5:1
 * (`__tests__/contrast.test.ts` holds the numbers).
 */
export const status = {
  success: colors.brand.mint,
  successSoft: colors.brand.mintSoft,
  successText: '#377A5E',
  warning: colors.brand.amber,
  warningSoft: colors.brand.amberSoft,
  warningText: '#97641B',
  danger: colors.brand.red,
  dangerSoft: colors.brand.redSoft,
  dangerText: '#C63C4E',
  info: colors.brand.lavender,
  infoSoft: colors.brand.lavenderSoft,
  infoText: '#6857E6',
} as const

/**
 * Accent palettes — the one thing the "Màu chủ đề" setting changes (#293 §6).
 * `theme.ts` builds a Unistyles theme per key; screens read `theme.accent.*`,
 * never this table.
 *
 * The spec's starting values put white text under AA on three of the four
 * (Cam 3.70 · Xanh lá 3.20 · Xanh dương 3.96 · Tím 4.56). Owner decision
 * 2026-09-24: keep each hue and saturation, lower lightness until white on
 * `primary` clears 4.5:1 on both white and ivory; `pressed` stays darker than
 * `primary`; `soft` is untouched. Measured (white / ivory):
 *   orange  #CA381F 5.13 / 4.63 · pressed #A72E19 (spec #C24633 was lighter than the new primary)
 *   green   #247D52 5.08 / 4.59 · pressed #1B5E3E (spec #248455, same reason)
 *   blue    #1A6CD5 5.06 / 4.57 · pressed #2565BF (spec value kept)
 *   purple  #7250F4 5.04 / 4.55 · pressed #6247CC (spec value kept)
 * Design confirms or re-tunes these against ADR-0009; the contrast test is the
 * gate either way.
 */
export const accents = {
  orange: { primary: '#CA381F', pressed: '#A72E19', soft: '#FFE3DA', onAccent: '#FFFFFF' },
  green: { primary: '#247D52', pressed: '#1B5E3E', soft: '#D9F3E5', onAccent: '#FFFFFF' },
  blue: { primary: '#1A6CD5', pressed: '#2565BF', soft: '#DCEAFF', onAccent: '#FFFFFF' },
  purple: { primary: '#7250F4', pressed: '#6247CC', soft: '#E6E0FF', onAccent: '#FFFFFF' },
} as const

/** Dark-theme surfaces (shared result / night screens, spec §46). */
export const night = {
  surface: '#222222',
  raised: '#2A2A2A',
  line: '#333333',
} as const

/** Text/icon colors over photos and dark backgrounds. */
export const onDark = {
  strong: 'rgba(255,255,255,0.9)',
  medium: 'rgba(255,255,255,0.8)',
  soft: 'rgba(255,255,255,0.6)',
} as const

/** Image scrims and modal backdrops. */
export const overlay = {
  scrimLight: 'rgba(0,0,0,0.2)',
  scrimMedium: 'rgba(0,0,0,0.25)',
  scrim: 'rgba(0,0,0,0.35)',
  scrimStrong: 'rgba(0,0,0,0.4)',
  backdrop: 'rgba(33,31,28,0.55)',
} as const

/**
 * Shadows. `warm`/`black` are the legacy `shadowColor` values still spread by
 * older style files. `card`/`cta`/`toast` are the Figma shadows (#293 §1) as
 * React Native style objects: a CSS `0 y blur rgba(c, a)` becomes
 * `shadowOffset {0, y}`, `shadowRadius blur / 2` (RN's radius is a Gaussian
 * sigma, CSS blur is roughly twice that) and `shadowOpacity a`; `elevation` is
 * the Android stand-in, scaled so the three keep their order.
 *
 * `cta` carries no `shadowColor`: it is the accent colour, so `theme.ts` fills
 * it in per theme.
 */
export const shadows = {
  warm: '#362D26',
  black: '#000',
  /** Figma `0 4 16 rgba(33,31,28,0.06)`. */
  card: {
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  /** Figma `0 6 16 rgba(<accent>,0.28)` — colour from `theme.accent.primary`. */
  cta: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  /** Figma `0 8 24 rgba(33,31,28,0.12)`. */
  toast: {
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const

/** Mock map canvas colors until a real map SDK lands. */
export const mapColors = {
  canvas: '#DCE9DC',
  road: 'rgba(255,255,255,0.55)',
} as const

/** White-alpha washes for glass surfaces, borders and tints. */
export const glassFx = {
  sheet: '#FCFBF8',
  bar: 'rgba(252,251,248,0.97)',
  solid: 'rgba(255,255,255,0.95)',
  pill: 'rgba(255,255,255,0.92)',
  cardWash: 'rgba(255,255,255,0.85)',
  chip: 'rgba(255,255,255,0.78)',
  border: 'rgba(255,255,255,0.72)',
  borderBright: 'rgba(255,255,255,0.9)',
  borderLight: 'rgba(255,255,255,0.8)',
  dockTint: 'rgba(255,255,255,0.55)',
  nativeTint: 'rgba(255,255,255,0.4)',
  nativeTintStrong: 'rgba(255,255,255,0.62)',
  badge: 'rgba(255,255,255,0.3)',
  btnBorder: 'rgba(255,255,255,0.26)',
  neutralChip: 'rgba(236,232,225,0.85)',
} as const

// Glass surfaces: RN has no backdrop blur without an extra native module, so the
// opaque fallback (spec §43.4/§48.3) is the default material on mobile until a
// blur adapter lands behind an ADR. Keep semantics, not the effect.
export const glass = {
  subtle: { background: 'rgba(255,255,255,0.38)', border: 'rgba(255,255,255,0.58)', blur: 16 },
  regular: { background: 'rgba(255,255,255,0.56)', border: 'rgba(255,255,255,0.72)', blur: 24 },
  strong: { background: 'rgba(255,255,255,0.76)', border: 'rgba(255,255,255,0.80)', blur: 28 },
  tint: {
    coral: 'rgba(255,216,212,0.58)',
    lavender: 'rgba(229,224,255,0.58)',
    mint: 'rgba(217,243,231,0.64)',
  },
  opaqueFallback: 'rgba(252,251,248,0.94)',
  /**
   * Tab bar and fixed bottom action bars (#293 §5): iOS 26 native glass where
   * `isLiquidGlassSupported`, else a blur with a 78 % `surface.card` wash and a
   * one-point `border.hairline` on top. `blur` is the Figma radius; `intensity`
   * is the `expo-blur` setting that stands in for it (0–100, provisional until
   * #296 measures it on a device — the wash, not the blur, carries contrast).
   */
  bar: {
    blur: 24,
    intensity: 60,
    wash: 'rgba(255,255,255,0.78)',
    hairline: colors.neutral[100],
  },
} as const

/**
 * Embedded Inter faces (`assets/fonts/`, registered through the `expo-font`
 * config plugin). Each string is the face's PostScript name, which is also its
 * file name, so iOS (`UIFont(name:)`) and Android (asset file name) resolve
 * the same `fontFamily`. Weight is chosen by picking a face: a `fontWeight`
 * next to one of these makes Android synthesise a fake bold from the wrong
 * file, and iOS silently pick another face — so the type scale carries none.
 */
export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extraBold: 'Inter-ExtraBold',
} as const

/**
 * Six sizes, no more (spec §7). Every screen spreads one of these instead of
 * writing `fontSize` — a scale with three near-identical sizes reads as
 * accidental, and that is what the app looked like before.
 *
 * `label` is not a seventh size: it is `bodySmall` at button weight, kept
 * separate so a CTA never drifts away from the scale.
 *
 * Weights per Figma Foundations (#293 §1): display/title1 Extra Bold, title2
 * Bold, body/bodySmall Regular, label Semi Bold, caption Medium. The invite
 * code uses `body` — the spec's `mono` style was dropped (owner, 2026-09-24).
 */
export const type = {
  display: { fontFamily: fontFamily.extraBold, fontSize: 28, lineHeight: 34 },
  title1: { fontFamily: fontFamily.extraBold, fontSize: 22, lineHeight: 28 },
  title2: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 15 },
  label: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18 },
} as const

/**
 * Emoji and symbol sizes.
 *
 * These are set with `fontSize` because that is how React Native sizes a glyph,
 * but they are pictures, not text: a 64pt 🎉 and a 64pt sentence have nothing to
 * do with each other. Forcing them into the six-step type scale would either
 * shrink the illustrations or add sizes to the scale no prose ever uses, and the
 * scale stops meaning anything once it carries both jobs.
 */
export const glyph = {
  xs: 18,
  sm: 24,
  md: 28,
  lg: 34,
  xl: 40,
  hero: 56,
  mega: 64,
} as const

export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48] as const

export const radius = {
  sheet: 28,
  hero: 24,
  card: 20,
  compact: 16,
  button: 16,
  pill: 999,
  thumbnail: 16,
} as const

export const motion = {
  fast: 140,
  standard: 240,
  slow: 320,
} as const

export const touchTarget = { min: 44 } as const

/**
 * Some controls are drawn smaller than `touchTarget.min` on purpose — a 28pt
 * lock toggle, a 36pt back button. Give those a slop so the *touch* area still
 * clears 44pt without changing the visual size.
 */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const

export type BrandColor = keyof typeof colors.brand
export type NeutralColor = keyof typeof colors.neutral
export type TypeStyle = keyof typeof type
export type AccentName = keyof typeof accents
