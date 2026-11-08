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
    // No coral here any more (#297): the accent is a theme role
    // (`accents` below → `theme.accent.*`), so a screen cannot pin one colour
    // that the "Màu chủ đề" setting is supposed to change.
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

/**
 * Text colours. `primary`/`secondary`/`tertiary` sit on light surfaces;
 * `tertiary` is placeholder-only: 1.6:1. `inverse` is white for a label on a
 * filled surface — a status fill, a photo scrim, a dark badge. On an accent
 * fill use `accent.onAccent` instead, so a theme can change it.
 */
export const text = {
  primary: colors.neutral[900],
  secondary: colors.neutral[500],
  tertiary: colors.neutral[300],
  inverse: colors.neutral[0],
} as const

/** Foreground on an opaque accent fill, independent of surface text/mode.
 * Every palette exposes this single semantic role as `accent.onAccent`.
 * Keep primary AND pressed fills at AA against it in both modes.
 */
export const onAccent = colors.neutral[0]

/**
 * Status colours. The base colour is a fill or a dot; `*Soft` is its pill
 * background; `*Text` is the only one of the three allowed to carry a label on
 * a light surface — the base values measure 2.4–2.7:1 on white for success and
 * warning, and no amount of weight makes that readable. `*Text` values are the
 * base hue darkened until white and ivory both clear 4.5:1
 * (`__tests__/contrast.test.ts` holds the numbers).
 *
 * #295 darkened all four once more: a chip or badge puts the label on its own
 * `*Soft` pill, and the #294 values measured 3.97–4.36 there. Same rule as A —
 * keep the hue, lower lightness until the label clears 4.5 on the pill too
 * (owner, 2026-09-24).
 */
export const status = {
  success: colors.brand.mint,
  successSoft: colors.brand.mintSoft,
  successText: '#35765B',
  warning: colors.brand.amber,
  warningSoft: colors.brand.amberSoft,
  warningText: '#8F5F1A',
  danger: colors.brand.red,
  dangerSoft: colors.brand.redSoft,
  dangerText: '#B43747',
  info: colors.brand.lavender,
  infoSoft: colors.brand.lavenderSoft,
  infoText: '#5F4FD1',
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
 *
 * `onSoft` (#295) is the accent as *text* on `soft` — a selected tab, the host
 * badge. `primary` on `soft` measures 3.9–4.3: fine for an icon or an outline,
 * not for a 13pt label. `onSoft` is the `pressed` hex in all four palettes
 * (orange 5.66 · green 6.59 · blue 4.67 · purple 5.00 on `soft`).
 *
 * `text` is the accent as a label or link on a plain surface. In light it is
 * `primary`; in dark `primary` is a fill (3.1:1 on the card) and `text` is the
 * lighter tint that clears AA there.
 */
export const accents = {
  orange: { primary: '#CA381F', text: '#CA381F', pressed: '#A72E19', soft: '#FFE3DA', onSoft: '#A72E19', onAccent },
  green: { primary: '#247D52', text: '#247D52', pressed: '#1B5E3E', soft: '#D9F3E5', onSoft: '#1B5E3E', onAccent },
  blue: { primary: '#1A6CD5', text: '#1A6CD5', pressed: '#2565BF', soft: '#DCEAFF', onSoft: '#2565BF', onAccent },
  purple: { primary: '#7250F4', text: '#7250F4', pressed: '#6247CC', soft: '#E6E0FF', onSoft: '#6247CC', onAccent },
} as const

// ---------------------------------------------------------------------------
// Dark roles. Values are read from the approved Stitch Dark screens (project
// 8730375380958217191): Home Dark 5e4ab03b837b4a8cb3278e30e7b8e916 and Splash
// Dark bf51ca613c7d4632a72d135476095d3f, from their Tailwind config and
// classes. A value Stitch does not carry is the previous value and is marked
// NOT FROM STITCH. Same keys as the light roles above, so a screen reads
// `theme.surface.card` and never branches on the mode.
// ---------------------------------------------------------------------------

export const darkSurface = {
  // canvas / surface / background (Home, Splash)
  canvas: '#181715',
  // card, surface-container-low
  card: '#222222',
  // surface-muted (Home), surface-container (Splash)
  subtle: '#2A2A2A',
} as const satisfies Record<keyof typeof surface, string>

export const darkBorder = {
  // border-[#333333] (Home), outline-variant (Splash)
  hairline: '#333333',
} as const satisfies Record<keyof typeof border, string>

export const darkText = {
  // ink, on-surface
  primary: '#E6E6E6',
  // ink-secondary, on-surface-variant
  secondary: '#CCCCCC',
  // outline (Splash). Placeholder-only, like the light `tertiary`.
  tertiary: '#999999',
  // on-primary
  inverse: '#FFFFFF',
} as const satisfies Record<keyof typeof text, string>

export const darkStatus = {
  // tertiary (Splash)
  success: '#4FAF86',
  // tertiary-container
  successSoft: '#16402F',
  // on-tertiary-container
  successText: '#A7E8CD',
  // the rating star on Home
  warning: '#E59700',
  // Stitch screen Bảng màu Dark a58c41190f214a94adb2982434e34120
  warningSoft: '#3D2E0B',
  warningText: '#FFD074',
  // Stitch screen Bảng màu Dark a58c41190f214a94adb2982434e34120
  danger: '#FF6B6B',
  // error-container (Splash)
  dangerSoft: '#4A1A20',
  // error (Splash)
  dangerText: '#FF8A94',
  // Stitch screen Bảng màu Dark a58c41190f214a94adb2982434e34120
  info: '#7B8CFF',
  // lavender-bg (Home), secondary-container (Splash)
  infoSoft: '#2F2A55',
  // lavender (Home), secondary (Splash)
  infoText: '#A99DF5',
} as const satisfies Record<keyof typeof status, string>

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
  /** A pressed wash on an accent fill. Same in both modes: the fill is saturated in both. */
  wash: 'rgba(255,255,255,0.3)',
} as const

/** Image scrims and modal backdrops. */
export const overlay = {
  scrimLight: 'rgba(0,0,0,0.2)',
  scrimMedium: 'rgba(0,0,0,0.25)',
  scrim: 'rgba(0,0,0,0.35)',
  scrimStrong: 'rgba(0,0,0,0.4)',
  /** Under white text on a photo: 0.6 black keeps 4.5:1 even over a white picture. */
  scrimText: 'rgba(0,0,0,0.6)',
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
  stitch: { shadowColor: colors.neutral[900], shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
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

/** Map surfaces and opaque Google tile style colors. */
export const mapColors = {
  canvas: '#DCE9DC',
  road: 'rgba(255,255,255,0.55)',
  roadFill: '#FFFFFF',
  water: '#B8D9E8',
  park: '#C5DDC5',
  label: text.secondary,
  labelStroke: surface.canvas,
} as const

/**
 * Map fallback surface in dark. NOT FROM STITCH: no Stitch Dark screen draws a
 * map. A desaturated green-black that sits between `darkSurface.canvas` and
 * `darkSurface.card`, keeping the light map's hue.
 */
export const darkMapColors = {
  canvas: '#1F2A22',
  road: 'rgba(255,255,255,0.12)',
  roadFill: night.line,
  water: '#15232E',
  park: '#24392B',
  label: darkText.secondary,
  labelStroke: night.surface,
} as const satisfies Record<keyof typeof mapColors, string>

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
    lavender: 'rgba(229,224,255,0.58)',
    mint: 'rgba(217,243,231,0.64)',
  },
  opaqueFallback: 'rgba(252,251,248,0.94)',
  /**
   * Tab bar and fixed bottom action bars (#293 §5): iOS 26 native glass where
   * `isLiquidGlassSupported`, else a blur with a 78 % `surface.card` wash and a
   * one-point `border.hairline` on top (`GlassBar`, #296).
   *
   * `blur` is the Figma radius (24pt CSS-style blur). `expo-blur` has no radius:
   * on iOS `intensity` is the fraction of a `UIBlurEffect(.light)` animator
   * (0–100), and a full system light blur reads at roughly a 30pt radius, so
   * 24 → 60 is the stand-in. It is provisional until design compares it on a
   * device, and it is safe to re-tune because the wash, not the blur, carries
   * contrast: `__tests__/contrast.test.ts` measures text on the wash alone.
   *
   * Android renders the wash with no blur at all (`GlassBar`): `expo-blur`
   * draws no real blur there unless `experimentalBlurMethod` is switched on,
   * and that path re-renders the content behind it every frame — the frame
   * cost the spec tells us not to pay on the Samsung test device.
   *
   * `wash` is `surface.card` (#FFFFFF) at 78 %.
   */
  bar: {
    blur: 24,
    intensity: 60,
    wash: 'rgba(255,255,255,0.78)',
    /** Opaque `surface.card`, for a path that cannot show translucency. */
    solid: colors.neutral[0],
    hairline: colors.neutral[100],
    /** `expo-blur` tint and `LiquidGlassView` colour scheme. */
    tint: 'light',
    /** Tint over the iOS 26 system glass. */
    nativeTint: 'rgba(255,255,255,0.4)',
  },
} as const

/**
 * The dark bar, from the Home Dark bottom nav: `bg-[#181715]/80` with a
 * `border-[#333333]/70` top edge. The wash carries contrast without the blur,
 * as the light one does; `solid` is the same colour opaque. `blur`,
 * `intensity`, `tint` and `nativeTint` are NOT FROM STITCH.
 */
export const darkGlass = {
  bar: {
    // NOT FROM STITCH: blur, intensity
    blur: 24,
    intensity: 60,
    wash: 'rgba(24,23,21,0.8)',
    solid: '#181715',
    hairline: 'rgba(51,51,51,0.7)',
    // NOT FROM STITCH: tint, nativeTint
    tint: 'dark',
    nativeTint: 'rgba(0,0,0,0.4)',
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
 * Six base sizes (spec §7), plus explicit approved Stitch redesign variants
 * (owner 2026-11-06 D1). Every screen spreads one of these instead of
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
  // Saved city Stitch 5cd4c60b: header, ward, card and metadata hierarchy.
  savedCityTitle: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 23 },
  avatarAction: { fontFamily: fontFamily.semiBold, fontSize: 14.5, lineHeight: 20 },
  avatarCancel: { fontFamily: fontFamily.bold, fontSize: 14.5, lineHeight: 20 },
  avatarCaption: { fontFamily: fontFamily.regular, fontSize: 11.5, lineHeight: 16 },
  avatarSubtitle: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  avatarReset: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20 },
  avatarTool: { fontFamily: fontFamily.semiBold, fontSize: 11.5, lineHeight: 16 },
  avatarPrimary: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20 },
  avatarSecondary: { fontFamily: fontFamily.bold, fontSize: 13.5, lineHeight: 20 },
  accountInput: { fontFamily: fontFamily.medium, fontSize: 14.5, lineHeight: 20 },
  savedWardTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
  savedCardTitle: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
  savedMeta: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  brand: { fontFamily: fontFamily.bold, fontSize: 38, lineHeight: 44 },
  discoveryTitle: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.33 },
  discoveryHeading: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.17 },
  discoveryHeader: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
  introTitle: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34 },
  introCompact: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30 },
  introHeading: { fontFamily: fontFamily.semiBold, fontSize: 17, lineHeight: 22 },
  introTagline: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 22 },
  introSection: { fontFamily: fontFamily.semiBold, fontSize: 22, lineHeight: 28 },
  introBody: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 20 },
  introRelaxed: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 24 },
  introSmall: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  introLabel: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18 },
  introCaption: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 14 },
  introCaptionMedium: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14 },
  illustrationBadge: { fontFamily: fontFamily.medium, fontSize: 10, lineHeight: 14 },
  mapLabel: { fontFamily: fontFamily.medium, fontSize: 9, lineHeight: 12 },
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

/**
 * Glyph text styles for `<Glyph size>` (#298). The size is the only thing a
 * glyph takes from here; it lives in this file so no screen writes `fontSize`.
 */
export const glyphText = {
  xs: { fontSize: glyph.xs },
  sm: { fontSize: glyph.sm },
  md: { fontSize: glyph.md },
  lg: { fontSize: glyph.lg },
  xl: { fontSize: glyph.xl },
  hero: { fontSize: glyph.hero },
  mega: { fontSize: glyph.mega },
} as const satisfies Record<keyof typeof glyph, { fontSize: number }>

/**
 * A layer that covers its parent — scrims, backdrops, image overlays. React
 * Native's `StyleSheet.absoluteFillObject` has no Unistyles counterpart that
 * can be spread (its type is a registered style), so style files spread this.
 */
export const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const

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
  mapReveal: 350,
  pinDrop: 250,
  pinFirstDelay: 350,
  pinStep: 200,
  brandDelay: 1000,
  brandReveal: 450,
  markerBounce: 400,
  ripple: 600,
  ping: 1000,
  splashHold: 1500,
  ambientWarm: 8000,
  ambientCool: 10000,
  pressScale: 0.98,
  pressScaleSubtle: 0.99,
  fast: 140,
  standard: 240,
  slow: 320,
} as const

/** Approved project 17315762413421369447. Screen-specific material roles. */
export const redesignLight = {
  savedCanvas: '#FAF7F2', savedLine: '#E5E5E5', savedMuted: '#737373',
  savedChip: '#F5F5F5', savedCount: '#E5E5E5', savedAccentSoft: '#FDF4F2', savedAccent: '#B82F15',
  savedGoogleFill: '#FFFBEB', savedGoogleText: '#92400E', savedGoogleLine: '#FDE68A',
  savedPhotoScrim: 'rgba(0,0,0,0.6)', savedOpenDot: '#34D399',
  importInputCanvas: '#FAF7F2', importInputLine: '#E5E5E5', importInputDim: '#F3EEE7', importInputPrimary: '#C2351D',
  importSyncedFill: '#9EF5C0', importSyncedText: '#002111', importPhotoBadgeText: '#C0FFD6',
  verifiedFill: '#247D52', primaryFill: '#CA381F', primaryText: '#A71E07', heroStart: '#FFE8E2', heroMiddle: '#FFF3EE', heroEnd: '#EAE6FE',
  canvas: '#FFF8F3', card: '#FFFFFF', low: '#F9F2ED', container: '#F3EDE8',
  high: '#EDE7E2', highest: '#E7E1DC', dim: '#DFD9D4',
  ink: '#1D1B18', secondary: '#5A413B', outline: '#8E706A', line: '#E3BEB7',
  checklistUnmet: '#8A6C66', recommendationFill: '#237C51',
  mutedTitle: '#211F1C', mutedBody: '#746E68',
  primary: '#A71E07', primarySoft: '#FFDAD3', moodSelected: '#FFE3DA',
  violet: '#7161E2', violetText: '#5747C8', violetSoft: '#E4DFFF', violetInk: '#170065',
  green: '#237C51', greenText: '#00623C', greenSoft: '#ECFFF3',
  white: '#FFFFFF', bubble: 'rgba(255,255,255,0.95)', panel: 'rgba(255,255,255,0.90)', header: 'rgba(255,248,243,0.85)',
  scrimStart: 'rgba(50,48,45,0.80)', scrimMiddle: 'rgba(50,48,45,0.20)',
  clear: 'rgba(50,48,45,0)', glowWarm: '#FFDAD3', glowCool: '#7161E2', glowGreen: '#237C51',
} as const

/** Undrawn dark materials derived from S70's canvas/card/accent/status roles. */
export const redesignDark = {
  savedCanvas: darkSurface.canvas, savedLine: darkBorder.hairline, savedMuted: darkText.secondary,
  savedChip: darkSurface.subtle, savedCount: '#333333', savedAccentSoft: '#2A2A2A', savedAccent: '#FF746C',
  savedGoogleFill: '#392C18', savedGoogleText: '#FDE68A', savedGoogleLine: '#69502B',
  savedPhotoScrim: redesignLight.savedPhotoScrim, savedOpenDot: redesignLight.savedOpenDot,
  importInputCanvas: darkSurface.canvas, importInputLine: darkBorder.hairline, importInputDim: darkSurface.subtle, importInputPrimary: '#CA381F',
  importSyncedFill: darkStatus.successSoft, importSyncedText: darkStatus.successText, importPhotoBadgeText: '#C0FFD6',
  verifiedFill: '#247D52', primaryFill: '#CA381F', primaryText: '#FF746C', heroStart: '#2A2A2A', heroMiddle: '#222222', heroEnd: '#2F2A55',
  canvas: darkSurface.canvas, card: darkSurface.card, low: darkSurface.subtle,
  container: darkSurface.subtle, high: '#333333', highest: '#333333', dim: '#333333',
  ink: darkText.primary, secondary: darkText.secondary, outline: darkText.tertiary, line: darkBorder.hairline,
  checklistUnmet: darkText.tertiary, recommendationFill: '#3B8365',
  mutedTitle: darkText.primary, mutedBody: darkText.secondary,
  primary: '#A72E19', primarySoft: '#2A2A2A', moodSelected: '#57332B',
  violet: '#7161E2', violetText: '#C7BFFF',
  violetSoft: '#2F2A55', violetInk: '#C7BFFF',
  green: darkStatus.success, greenText: darkStatus.successText, greenSoft: darkStatus.successSoft,
  white: '#FFFFFF', bubble: 'rgba(34,34,34,0.95)', panel: 'rgba(34,34,34,0.90)', header: 'rgba(24,23,21,0.85)',
  scrimStart: redesignLight.scrimStart, scrimMiddle: redesignLight.scrimMiddle, clear: redesignLight.clear,
  glowWarm: '#FF746C', glowCool: '#7161E2', glowGreen: darkStatus.success,
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
export type GlyphSize = keyof typeof glyph
export type AccentName = keyof typeof accents

/**
 * Dark accent palettes. Orange is from Stitch: `primary` #CA381F and `pressed`
 * (primary-hover) #A72E19 on Home, `text` and `onSoft` #FF746C on Home and
 * Splash, `soft` #2A2A2A (the "Tối nay" pill on Home). Green, blue and purple are from
 * Stitch screen Bảng màu Dark a58c41190f214a94adb2982434e34120.
 */
export const darkAccents = {
  orange: { primary: '#CA381F', text: '#FF746C', pressed: '#A72E19', soft: '#2A2A2A', onSoft: '#FF746C', onAccent },
  // Stitch screen Bảng màu Dark a58c41190f214a94adb2982434e34120
  green: { primary: '#247D52', text: '#79D9AD', pressed: '#1A5E3D', soft: '#16402F', onSoft: '#79D9AD', onAccent },
  blue: { primary: '#1E68D7', text: '#94BEF7', pressed: '#164EB0', soft: '#192B45', onSoft: '#94BEF7', onAccent },
  purple: { primary: '#7161E2', text: '#C7BFFF', pressed: '#5747C8', soft: '#2F2A55', onSoft: '#C7BFFF', onAccent },
} as const satisfies Record<AccentName, Record<keyof (typeof accents)['orange'], string>>

/** Owner Stitch avatar editor: fixed dark photo workspace in both themes. */
export const photoEditor = {
  canvas: '#121212', dock: '#181818', black: '#000000',
  line: '#333333', raised: '#262626', pressed: '#444444',
  pill: '#000000BF', white: '#FFFFFF',
} as const
