// Warm Liquid Glass design tokens — single source of truth for the mobile app.
// Values come from GOGO_FEATURE_IMPROVEMENT_SPEC.md §42–§49; keep in sync with the
// shared design-tokens package once it is published (FND-003/FND-009).

export const colors = {
  brand: {
    coral: '#D84F4A',
    /** Gradient end for the primary CTA (spec §45.2). */
    coralDeep: '#C74552',
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
    300: '#C8C1B8',
    500: '#817B74',
    700: '#4A4641',
    900: '#211F1C',
  },
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

export const shadows = {
  warm: '#362D26',
  black: '#000',
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
