import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACCENTS, accentOf, modeOf, themeName, themes } from '../theme'
import { accents, darkAccents, darkBorder, darkStatus, darkSurface, darkText, surface } from '../tokens'

/**
 * Theme foundation. Dark is the same set of roles with other values, in four
 * accents, chosen by the device. The owner-approved values come from
 * `stitch-design.md` §4; the rest are held to AA here.
 */
const AA_TEXT = 4.5
const AA_LARGE = 3

function luminance(hex: string): number {
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const DARK_SURFACES = [darkSurface.canvas, darkSurface.card] as const

describe('dark tokens', () => {
  it('uses the owner-approved values', () => {
    expect(darkSurface).toEqual({ canvas: '#181715', card: '#222222', subtle: '#2A2A2A' })
    expect(darkBorder.hairline).toBe('#333333')
    expect(darkAccents.orange.primary).toBe('#CA381F')
    expect(darkAccents.orange.onSoft).toBe('#FF746C')
  })

  it('has every role the light set has', () => {
    expect(Object.keys(darkSurface)).toEqual(Object.keys(surface))
    expect(Object.keys(darkAccents.orange).sort()).toEqual(Object.keys(accents.orange).sort())
  })

  it('body and secondary text read at AA on the dark canvas, card and raised surface', () => {
    for (const bg of [...DARK_SURFACES, darkSurface.subtle]) {
      expect(contrast(darkText.primary, bg)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(darkText.secondary, bg)).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it.each([
    ['success', darkStatus.successText, darkStatus.successSoft],
    ['warning', darkStatus.warningText, darkStatus.warningSoft],
    ['danger', darkStatus.dangerText, darkStatus.dangerSoft],
    ['info', darkStatus.infoText, darkStatus.infoSoft],
  ])('%s label reads at AA on its pill and on the dark surfaces', (_n, label, pill) => {
    expect(contrast(label, pill)).toBeGreaterThanOrEqual(AA_TEXT)
    for (const bg of DARK_SURFACES) expect(contrast(label, bg)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  describe.each(ACCENTS)('%s accent', accent => {
    const { primary, soft, onSoft, onAccent } = darkAccents[accent]

    it('keeps white text on the filled accent at AA', () => {
      expect(contrast(onAccent, primary)).toBeGreaterThanOrEqual(AA_TEXT)
    })
    it('reads the accent as text on the dark surfaces and on its soft wash', () => {
      for (const bg of DARK_SURFACES) expect(contrast(onSoft, bg)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(onSoft, soft)).toBeGreaterThanOrEqual(AA_TEXT)
    })
    it('reads the fill as a boundary on the canvas and card', () => {
      for (const bg of DARK_SURFACES) expect(contrast(primary, bg)).toBeGreaterThanOrEqual(AA_LARGE)
    })
  })
})

describe('theme table', () => {
  it('has every accent in both modes, with the same keys', () => {
    const shapes = Object.values(themes).map(t => Object.keys(t).sort().join(','))
    expect(Object.keys(themes)).toHaveLength(ACCENTS.length * 2)
    expect(new Set(shapes).size).toBe(1)
  })

  it.each(ACCENTS)('%s: dark differs from light in colour roles only', accent => {
    const light = themes[themeName(accent, 'light')]
    const dark = themes[themeName(accent, 'dark')]
    expect(light.mode).toBe('light')
    expect(dark.mode).toBe('dark')
    expect(dark.surface).toBe(darkSurface)
    expect(dark.text).toBe(darkText)
    expect(dark.accent).toBe(darkAccents[accent])
    expect(dark.spacing).toBe(light.spacing)
    expect(dark.radius).toBe(light.radius)
    expect(dark.type).toBe(light.type)
    expect(dark.shadows.cta.shadowColor).toBe(dark.accent.primary)
  })
})

describe('theme names', () => {
  it('light keeps the bare accent key, dark appends Dark', () => {
    expect(themeName('green', 'light')).toBe('green')
    expect(themeName('green', 'dark')).toBe('greenDark')
  })
  it('accentOf reads either mode and rejects anything else', () => {
    expect(accentOf('bluedark')).toBeUndefined()
    expect(accentOf('blueDark')).toBe('blue')
    expect(accentOf('purple')).toBe('purple')
    expect(accentOf('coral')).toBeUndefined()
    expect(accentOf(undefined)).toBeUndefined()
  })
  it('modeOf treats anything but dark as light (an unset scheme)', () => {
    expect(modeOf('dark')).toBe('dark')
    expect(modeOf('light')).toBe('light')
    expect(modeOf(null)).toBe('light')
  })
})

describe('native config', () => {
  it('lets the device choose the appearance (needs a new native build to take effect)', () => {
    const source = readFileSync(path.resolve(__dirname, '../../../../app.config.ts'), 'utf8')
    expect(source).toMatch(/userInterfaceStyle:\s*'automatic'/)
    expect(source).not.toMatch(/userInterfaceStyle:\s*'light'/)
  })
})
