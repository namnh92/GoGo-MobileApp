import { describe, expect, it } from 'vitest'

import { ACCENTS, DEFAULT_ACCENT, themes } from '../theme'
import { border, glass, radius, spacing, status, surface, text, type } from '../tokens'

/**
 * #294. The four themes differ in the accent and nothing else: a screen styled
 * against `theme.surface.card` must get the same card in every theme, or
 * "change the accent" quietly becomes "change the app".
 */
describe('accent themes', () => {
  it('defaults to orange — the one closest to the coral the app shipped with', () => {
    expect(DEFAULT_ACCENT).toBe('orange')
    expect(ACCENTS[0]).toBe(DEFAULT_ACCENT)
  })

  it('every theme exposes the same keys', () => {
    const shapes = ACCENTS.map(accent => Object.keys(themes[accent]).sort().join(','))
    expect(new Set(shapes).size).toBe(1)
  })

  it.each(ACCENTS)('%s shares every fixed role with tokens.ts', accent => {
    const theme = themes[accent]
    expect(theme.surface).toBe(surface)
    expect(theme.border).toBe(border)
    expect(theme.text).toBe(text)
    expect(theme.status).toBe(status)
    expect(theme.type).toBe(type)
    expect(theme.spacing).toBe(spacing)
    expect(theme.radius).toBe(radius)
    expect(theme.glass.bar).toBe(glass.bar)
  })

  it('only the accent — and the CTA shadow that borrows it — varies between themes', () => {
    const [first, ...rest] = ACCENTS.map(accent => themes[accent])
    for (const theme of rest) {
      const { accent: _a, shadows: _s, ...fixed } = theme
      const { accent: _b, shadows: _t, ...expected } = first!
      expect(fixed).toEqual(expected)
      expect(theme.shadows.card).toEqual(first!.shadows.card)
      expect(theme.shadows.toast).toEqual(first!.shadows.toast)
      expect(theme.shadows.cta.shadowColor).toBe(theme.accent.primary)
    }
  })

  it('no two themes share a primary', () => {
    const primaries = ACCENTS.map(accent => themes[accent].accent.primary)
    expect(new Set(primaries).size).toBe(ACCENTS.length)
  })
})
