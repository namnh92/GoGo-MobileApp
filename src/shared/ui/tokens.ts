// AppToken colours: one shared set of roles for the whole app (#556).
// Authority: Stitch re-design, S70 + Bảng màu Light/Dark. See
// docs/verification/issue-556-color-tokens.md for provenance and the full map.
// Pure TypeScript: consumed by theme.ts and arithmetic tests.

/** Official option A/B ribbon palette (Stitch ed67babc, owner 2026-11-09).
 * Brand artwork stays fixed across user accents and light/dark modes. */
export const brandLogo = {
  background: '#20124A',
  highlight: '#FFFFFF',
  stars: ['#91ECD4', '#FFEAA7'],
  dots: ['#FF5252', '#FF9E66', '#55D8C1'],
  spectrum: [
    [0, '#FF5252'], [16, '#FF6558'], [30, '#FF8264'],
    [42, '#FFA872'], [50, '#FFCA7D'], [58, '#B2EAB8'],
    [70, '#72E3C0'], [84, '#55D8C7'], [100, '#3DCBC8'],
  ],
  bridge: [
    [0, '#FFA46E', 0], [26, '#FFB675', 0.92], [50, '#FFCA7D', 1],
    [74, '#A6ECC8', 0.92], [100, '#60E2C2', 0],
  ],
} as const

/** Surface hierarchy. Keep real Stitch levels separate, including in Dark.
 * inset = neutral canvas; muted = quiet neutral fill; disabled = count/disabled fill.
 * subtle is the compatibility alias for container, not another palette. */
export const surface = {
  canvas: '#FFF8F3',
  card: '#FFFFFF',
  subtle: '#F3EDE8',
  low: '#F9F2ED',
  container: '#F3EDE8',
  high: '#EDE7E2',
  highest: '#E7E1DC',
  dim: '#DFD9D4',
  inset: '#FAF7F2',
  muted: '#F3EEE7',
  disabled: '#E5E5E5'
} as const

export const darkSurface = {
  canvas: '#181715',
  card: '#222222',
  subtle: '#2A2A2A',
  low: '#2A2A2A',
  container: '#2A2A2A',
  high: '#333333',
  highest: '#333333',
  dim: '#333333',
  inset: '#181715',
  muted: '#2A2A2A',
  disabled: '#333333'
} as const satisfies Record<keyof typeof surface, string>

/** Primary, secondary, decorative tertiary, and AA supporting text.
 * Neutral foregrounds are explicitly drawn by the Stitch Light palette. */
export const text = {
  primary: '#1D1B18',
  secondary: '#5A413B',
  tertiary: '#8E706A',
  inverse: '#FFFFFF',
  supporting: '#8A6C66',
  neutralPrimary: '#211F1C',
  neutralSecondary: '#746E68'
} as const

export const darkText = {
  primary: '#E6E6E6',
  secondary: '#CCCCCC',
  tertiary: '#999999',
  inverse: '#FFFFFF',
  supporting: '#999999',
  neutralPrimary: '#E6E6E6',
  neutralSecondary: '#CCCCCC'
} as const satisfies Record<keyof typeof text, string>

export const border = {
  hairline: '#E3BEB7',
  outline: '#8E706A',
  neutral: '#E5E5E5'
} as const

export const darkBorder = {
  hairline: '#333333',
  outline: '#999999',
  neutral: '#333333'
} as const satisfies Record<keyof typeof border, string>

/** Status fills, text, and text-bearing containers are separate roles. */
export const status = {
  success: '#237C51',
  successSoft: '#ECFFF3',
  successText: '#00623C',
  warning: '#D99028',
  warningSoft: '#FBEBD3',
  warningText: '#8F5F1A',
  danger: '#CC4B46',
  dangerSoft: '#FBE3E2',
  dangerText: '#B43747',
  info: '#7161E2',
  infoSoft: '#E4DFFF',
  infoText: '#5747C8',
  successFill: '#237C51',
  successStrongFill: '#247D52',
  successContainer: '#9EF5C0',
  onSuccessContainer: '#002111',
  infoInk: '#170065',
  infoGradient: '#EAE6FE'
} as const

export const darkStatus = {
  success: '#4FAF86',
  successSoft: '#16402F',
  successText: '#A7E8CD',
  warning: '#E59700',
  warningSoft: '#3D2E0B',
  warningText: '#FFD074',
  danger: '#FF6B6B',
  dangerSoft: '#4A1A20',
  dangerText: '#FF8A94',
  info: '#7161E2',
  infoSoft: '#2F2A55',
  infoText: '#C7BFFF',
  successFill: '#3B8365',
  successStrongFill: '#247D52',
  successContainer: '#16402F',
  onSuccessContainer: '#A7E8CD',
  infoInk: '#C7BFFF',
  infoGradient: '#2F2A55'
} as const satisfies Record<keyof typeof status, string>

export const onAccent = text.inverse

/** User-selectable accents. Extra steps preserve Stitch emphasis/materials.
 * All accent-like colour, including gradients and ambient glows, reads these. */
export const accents = {
  orange: {
    primary: '#CA381F',
    text: '#A71E07',
    pressed: '#A72E19',
    soft: '#FFE3DA',
    onSoft: '#A71E07',
    onAccent: '#FFFFFF',
    primaryDeep: '#A71E07',
    primaryMuted: '#C2351D',
    textMuted: '#B82F15',
    container: '#FFDAD3',
    selected: '#FFE3DA',
    gradientStart: '#FFE8E2',
    gradientMiddle: '#FFF3EE',
    glow: '#FFDAD3'
  },
  green: {
    primary: '#247D52',
    text: '#247D52',
    pressed: '#1B5E3E',
    soft: '#D9F3E5',
    onSoft: '#1B5E3E',
    onAccent: '#FFFFFF',
    primaryDeep: '#1B5E3E',
    primaryMuted: '#247D52',
    textMuted: '#247D52',
    container: '#D9F3E5',
    selected: '#D9F3E5',
    gradientStart: '#D9F3E5',
    gradientMiddle: '#F9F2ED',
    glow: '#D9F3E5'
  },
  blue: {
    primary: '#1A6CD5',
    text: '#1A6CD5',
    pressed: '#2565BF',
    soft: '#DCEAFF',
    onSoft: '#2565BF',
    onAccent: '#FFFFFF',
    primaryDeep: '#2565BF',
    primaryMuted: '#1A6CD5',
    textMuted: '#1A6CD5',
    container: '#DCEAFF',
    selected: '#DCEAFF',
    gradientStart: '#DCEAFF',
    gradientMiddle: '#F9F2ED',
    glow: '#DCEAFF'
  },
  purple: {
    primary: '#7250F4',
    text: '#7250F4',
    pressed: '#6247CC',
    soft: '#E6E0FF',
    onSoft: '#6247CC',
    onAccent: '#FFFFFF',
    primaryDeep: '#6247CC',
    primaryMuted: '#7250F4',
    textMuted: '#7250F4',
    container: '#E6E0FF',
    selected: '#E6E0FF',
    gradientStart: '#E6E0FF',
    gradientMiddle: '#F9F2ED',
    glow: '#E6E0FF'
  }
} as const

export const darkAccents = {
  orange: {
    primary: '#CA381F',
    text: '#FF746C',
    pressed: '#A72E19',
    soft: '#2A2A2A',
    onSoft: '#FF746C',
    onAccent: '#FFFFFF',
    primaryDeep: '#A72E19',
    primaryMuted: '#CA381F',
    textMuted: '#FF746C',
    container: '#2A2A2A',
    selected: '#472C25',
    gradientStart: '#2A2A2A',
    gradientMiddle: '#222222',
    glow: '#FF746C'
  },
  green: {
    primary: '#247D52',
    text: '#79D9AD',
    pressed: '#1A5E3D',
    soft: '#16402F',
    onSoft: '#79D9AD',
    onAccent: '#FFFFFF',
    primaryDeep: '#1A5E3D',
    primaryMuted: '#247D52',
    textMuted: '#79D9AD',
    container: '#16402F',
    selected: '#16402F',
    gradientStart: '#16402F',
    gradientMiddle: '#222222',
    glow: '#79D9AD'
  },
  blue: {
    primary: '#1E68D7',
    text: '#94BEF7',
    pressed: '#164EB0',
    soft: '#192B45',
    onSoft: '#94BEF7',
    onAccent: '#FFFFFF',
    primaryDeep: '#164EB0',
    primaryMuted: '#1E68D7',
    textMuted: '#94BEF7',
    container: '#192B45',
    selected: '#192B45',
    gradientStart: '#192B45',
    gradientMiddle: '#222222',
    glow: '#94BEF7'
  },
  purple: {
    primary: '#7161E2',
    text: '#C7BFFF',
    pressed: '#5747C8',
    soft: '#2F2A55',
    onSoft: '#C7BFFF',
    onAccent: '#FFFFFF',
    primaryDeep: '#5747C8',
    primaryMuted: '#7161E2',
    textMuted: '#C7BFFF',
    container: '#2F2A55',
    selected: '#2F2A55',
    gradientStart: '#2F2A55',
    gradientMiddle: '#222222',
    glow: '#C7BFFF'
  }
} as const satisfies Record<keyof typeof accents, Record<keyof (typeof accents)['orange'], string>>

/** Dark-theme surfaces (shared result / night screens, spec §46). */
export const night = {
  surface: '#222222',
  raised: '#2A2A2A',
  line: '#333333',
} as const

/** Text/icon colors over photos and dark backgrounds. */
export const onDark = {
  success: darkStatus.successText,
  danger: darkStatus.dangerText,
  strong: 'rgba(255,255,255,0.9)',
  medium: 'rgba(255,255,255,0.8)',
  soft: 'rgba(255,255,255,0.6)',
  /** A pressed wash on an accent fill. Same in both modes: the fill is saturated in both. */
  wash: 'rgba(255,255,255,0.3)',
} as const

/** Image scrims and modal backdrops. */
export const overlay = {
  gradientStrong: 'rgba(50,48,45,0.80)',
  gradientLight: 'rgba(50,48,45,0.20)',
  clear: 'rgba(50,48,45,0)',
  scrimLight: 'rgba(0,0,0,0.2)',
  scrimMedium: 'rgba(0,0,0,0.25)',
  scrim: 'rgba(0,0,0,0.35)',
  scrimStrong: 'rgba(0,0,0,0.4)',
  /** Under white text on a photo: 0.6 black keeps 4.5:1 even over a white picture. */
  scrimText: 'rgba(0,0,0,0.6)',
  backdrop: 'rgba(33,31,28,0.55)',
  /** Dark canvas at 85% in both modes: keep the form faintly visible during submit. */
  submit: 'rgba(24,23,21,0.85)',
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
  subtle: { shadowColor: text.neutralPrimary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  warm: '#362D26',
  black: '#000',
  /** Figma `0 4 16 rgba(33,31,28,0.06)`. */
  card: {
    shadowColor: text.neutralPrimary,
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
    shadowColor: text.neutralPrimary,
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
  sheet: surface.canvas,
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
  opaque: 'rgba(255,255,255,0.95)',
  translucent: 'rgba(255,255,255,0.90)',
  header: 'rgba(255,248,243,0.85)',
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
    solid: surface.card,
    hairline: border.hairline,
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
  opaque: 'rgba(34,34,34,0.95)',
  translucent: 'rgba(34,34,34,0.90)',
  header: 'rgba(24,23,21,0.85)',
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
  /** Shared tab labels: Stitch caption size at semibold weight (#575). */
  tabLabel: { fontFamily: fontFamily.semiBold, fontSize: 11, lineHeight: 15 },
  label: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18 },
  buttonLabel: { fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 20 },
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

/** Outer rhythm shared by the four tab roots; card internals keep their own scale. */
export const tabRootSpacing = {
  headerContent: spacing[4],
  section: spacing[5],
  headingContent: spacing[3],
} as const

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
  loadingBounce: 2000,
  loadingBeam: 2400,
  instant: 0,
  logoBounce: 2000,
  logoBeam: 2400,
  logoStarFirst: 2400,
  logoStarSecond: 2800,
  logoStarDelay: 500,
  logoDot: 1200,
  logoDotDelay: 200,
  logoBounceEasing: [0.28, 0.84, 0.42, 1],
  logoPulseEasing: [0.42, 0, 0.58, 1],
  // Owner's splash pacing: 1.5× the original entrance and hold.
  mapReveal: 525,
  pinDrop: 375,
  pinFirstDelay: 525,
  pinStep: 300,
  brandDelay: 1500,
  brandReveal: 675,
  markerBounce: 600,
  ripple: 900,

  ping: 1000,
  splashHold: 2250,
  ambientWarm: 8000,
  ambientCool: 10000,
  pressScale: 0.98,
  pressScaleSubtle: 0.99,
  fast: 140,
  standard: 240,
  slow: 320,
} as const

/** Loading geometry and shadow remain independent of the shared logo artwork. */
export const loadingIndicator = {
  size: 48,
  overlaySize: 80,
  compactSize: 24,
  ...brandLogo,
  shadow: { shadowColor: '#363254', shadowOffset: { width: 0, height: 1.8 }, shadowOpacity: 0.28, shadowRadius: 1.8 },
} as const


/** Shared button geometry; minHeight allows wrapped action labels to grow. */
export const buttonSizes = {
  regular: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, label: 'buttonLabel', iconSize: 20 },
  small: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, label: 'label', iconSize: 18 },
} as const
export type ButtonSize = keyof typeof buttonSizes

export const touchTarget = { min: 44 } as const

/**
 * Some controls are drawn smaller than `touchTarget.min` on purpose — a 28pt
 * lock toggle, a 36pt back button. Give those a slop so the *touch* area still
 * clears 44pt without changing the visual size.
 */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const

export type TypeStyle = keyof typeof type
export type GlyphSize = keyof typeof glyph
export type AccentName = keyof typeof accents

/** Fixed dark workspace for editing photos, independent of appearance. */
export const workspace = {
  canvas: '#121212',
  surface: '#181818',
  void: '#000000',
  border: '#333333',
  raised: '#262626',
  emphasis: '#444444',
  scrim: '#000000BF',
  foreground: '#FFFFFF'
} as const
