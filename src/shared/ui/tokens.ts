// Warm Liquid Glass design tokens — single source of truth for the mobile app.
// Values come from GOGO_FEATURE_IMPROVEMENT_SPEC.md §42–§49; keep in sync with the
// shared design-tokens package once it is published (FND-003/FND-009).

export const colors = {
  brand: {
    coral: '#D84F4A',
    coralBright: '#FF746C',
    coralSoft: '#FFD8D4',
    lavender: '#7667E8',
    lavenderSoft: '#E5E0FF',
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

export type BrandColor = keyof typeof colors.brand
export type NeutralColor = keyof typeof colors.neutral
