import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as tokens from '../tokens'
import { themes } from '../theme'
import pins from './fixtures/stitch-color-pins.json'

const SRC = path.resolve(__dirname, '../../..')
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? entry.name === '__tests__' ? [] : walk(full) : /\.tsx?$/.test(full) && !/\.(spec|test)\.tsx?$/.test(full) ? [full] : []
  })
}
function colorPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return /^(#|rgba?\(|hsla?\()/.test(value) ? [prefix] : []
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => colorPaths(child, prefix ? `${prefix}.${key}` : key))
}
// Explicit role vocabulary: nesting a feature palette under surface is also forbidden.
const ROLE_KEYS = new Set(`canvas card subtle low container high highest dim inset muted disabled
  primary secondary tertiary inverse supporting neutralPrimary neutralSecondary hairline outline neutral
  success successSoft successText successFill successStrongFill successContainer onSuccessContainer
  warning warningSoft warningText danger dangerSoft dangerText info infoSoft infoText infoInk infoGradient
  orange green blue purple text pressed soft onSoft onAccent primaryDeep primaryMuted textMuted selected gradientStart gradientMiddle glow
  surface raised line strong medium wash warm black shadowColor toast cta
  scrimLight scrimMedium scrim scrimStrong scrimText backdrop gradientStrong gradientLight clear
  road roadFill water park label labelStroke sheet bar solid pill cardWash chip border borderBright borderLight
  dockTint nativeTint nativeTintStrong badge btnBorder neutralChip background tint opaqueFallback
  opaque translucent header regular lavender mint void emphasis foreground
  submit submitLight submitDark highlight stars dots spectrum bridge sheen sparkleMint sparkleAmber shadow 0 1 2 3 4 5 6 7 8`.split(/\s+/))
const TOKEN_GROUPS = new Set(`surface darkSurface text darkText border darkBorder status darkStatus accents darkAccents onAccent
  night onDark overlay shadows mapColors darkMapColors glassFx glass darkGlass workspace brandLogo loadingIndicator`.split(/\s+/))
const THEME_GROUPS = new Set('surface text border status accent night onDark overlay shadows map glass workspace'.split(' '))
function invalidRoles(value: unknown, roots: Set<string>) {
  return colorPaths(value).filter(role => {
    const [root, ...keys] = role.split('.')
    return !roots.has(root) || keys.some(key => !ROLE_KEYS.has(key))
  })
}
function references(source: string) {
  return [...source.matchAll(/\btheme\.(surface|text|border|accent|status|overlay|glass|map|workspace|night|onDark)\.(\w+)|['"]((?:surface|text|border|accent|status|overlay|glass|map|workspace|night|onDark)\.\w+)['"]/g)]
    .map(match => match[3] || `${match[1]}.${match[2]}`)
}

describe('one AppToken colour set (#556)', () => {
  it('allows only shared role names in all exports and themes, including unused leaves', () => {
    expect(colorPaths(tokens).length).toBeGreaterThan(100)
    expect(invalidRoles(tokens, TOKEN_GROUPS)).toEqual([])
    for (const theme of Object.values(themes)) expect(invalidRoles(theme, THEME_GROUPS)).toEqual([])
  })
  it('preserves the official shared logo palette and loading shadow from #587', () => {
    expect(tokens.brandLogo).toEqual({
      background: '#20124A', highlight: '#FFFFFF',
      stars: ['#91ECD4', '#FFEAA7'], dots: ['#FF5252', '#FF9E66', '#55D8C1'],
      spectrum: [
        [0, '#FF5252'], [16, '#FF6558'], [30, '#FF8264'],
        [42, '#FFA872'], [50, '#FFCA7D'], [58, '#B2EAB8'],
        [70, '#72E3C0'], [84, '#55D8C7'], [100, '#3DCBC8'],
      ],
      bridge: [
        [0, '#FFA46E', 0], [26, '#FFB675', 0.92], [50, '#FFCA7D', 1],
        [74, '#A6ECC8', 0.92], [100, '#60E2C2', 0],
      ],
    })
    for (const key of Object.keys(tokens.brandLogo) as (keyof typeof tokens.brandLogo)[]) {
      expect(tokens.loadingIndicator[key]).toBe(tokens.brandLogo[key])
    }
    expect(tokens.loadingIndicator.shadow).toEqual({ shadowColor: '#363254', shadowOffset: { width: 0, height: 1.8 }, shadowOpacity: 0.28, shadowRadius: 1.8 })
  })
  it('rejects feature names even inside an allowed role group', () => {
    for (const key of ['savedCanvas', 'importInputPrimary', 'heroStart', 'moodSelected', 'checklistUnmet', 'recommendationFill']) {
      expect(invalidRoles({ surface: { [key]: tokens.surface.canvas } }, TOKEN_GROUPS)).toEqual([`surface.${key}`])
    }
  })
  it('all eight themes have identical role shapes and the same fixed workspace', () => {
    for (const theme of Object.values(themes)) {
      expect(colorPaths(theme).sort()).toEqual(colorPaths(themes.orange).sort())
      expect(theme.workspace).toBe(tokens.workspace)
      expect(theme.workspace).toEqual(pins.workspace)
    }
  })
  it('removes the old palette and its imports, including bracket/destructured reads', () => {
    const removed = /\bredesign(?:Light|Dark)\b|\bphotoEditor\b|(?:\.|\[\s*['"]|\{\s*)redesign\b/
    expect(walk(SRC).filter(file => removed.test(readFileSync(file, 'utf8'))).map(file => path.relative(SRC, file))).toEqual([])
    expect(tokens).not.toHaveProperty('colors')
  })
  it('pins every live redesigned role to its pre-migration Stitch value in both orange modes', () => {
    expect(pins.base).toBe('f28f617')
    for (const [role, expected] of Object.entries(pins.roles)) {
      const [group, key] = role.split('.')
      for (const [i, theme] of [themes.orange, themes.orangeDark].entries()) {
        const actual = (theme[group as keyof typeof theme] as unknown as Record<string, unknown>)[key]
        expect(actual, `${theme.mode} ${role}`).toBe(expected[i])
      }
    }
  })
  it('pins actual view/style role bindings, so unused correct tokens cannot mask a repaint', () => {
    expect(Object.keys(pins.bindings).length).toBeGreaterThan(50)
    for (const [file, expected] of Object.entries(pins.bindings)) {
      expect(references(readFileSync(path.resolve(SRC, '..', file), 'utf8')), file).toEqual(expected)
    }
  })
  it('keeps each Stitch surface level, never folding dark inset/container into canvas', () => {
    expect(['low', 'container', 'high', 'highest', 'dim'].map(key => tokens.surface[key as keyof typeof tokens.surface]))
      .toEqual(['#F9F2ED', '#F3EDE8', '#EDE7E2', '#E7E1DC', '#DFD9D4'])
    expect(tokens.darkSurface.low).toBe('#2A2A2A')
    expect(tokens.darkSurface.low).not.toBe(tokens.darkSurface.canvas)
    expect(tokens.darkSurface.high).toBe('#333333')
  })
})
