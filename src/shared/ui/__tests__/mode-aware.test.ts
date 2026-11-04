import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACCENTS, themes } from '../theme'
import { accents, darkAccents, darkGlass, darkSurface, darkText, glass } from '../tokens'

/**
 * Dark-device defects on PR #421. The contrast side is arithmetic; the
 * structure side is a scan, because a static stylesheet cannot be asked what it
 * would look like in dark: it has one answer.
 */
const AA_TEXT = 4.5

function luminance(hex: string): number {
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
function composite(wash: string, backdrop: string): string {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(wash)!
  const alpha = Number(m[4])
  const channels = [1, 2, 3].map((n, i) =>
    Math.round(Number(m[n]) * alpha + parseInt(backdrop.slice(1 + i * 2, 3 + i * 2), 16) * (1 - alpha)),
  )
  return `#${channels.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

describe('accent as text', () => {
  it.each(ACCENTS)('%s: light text is the primary, so light is unchanged', accent => {
    expect(accents[accent].text).toBe(accents[accent].primary)
  })

  it.each(ACCENTS)('%s: dark text reads at AA on every dark surface and on the dark bar', accent => {
    const { text } = darkAccents[accent]
    for (const bg of [darkSurface.canvas, darkSurface.card, darkSurface.subtle]) {
      expect(contrast(text, bg)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(text, composite(darkGlass.bar.wash, bg))).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it('the primary fill is not a text colour in dark — which is why the role exists', () => {
    expect(contrast(darkAccents.orange.primary, darkSurface.card)).toBeLessThan(AA_TEXT)
  })

  it('the themes expose the role per mode', () => {
    expect(themes.orange.accent.text).toBe(accents.orange.text)
    expect(themes.orangeDark.accent.text).toBe('#FF746C')
  })
})

describe('the dark bar', () => {
  it('is the Stitch Home Dark nav: canvas at 80 %, a solid fallback and a 70 % hairline', () => {
    expect(darkGlass.bar.wash).toBe('rgba(24,23,21,0.8)')
    expect(darkGlass.bar.solid).toBe(darkSurface.canvas)
    expect(darkGlass.bar.hairline).toBe('rgba(51,51,51,0.7)')
    expect(darkGlass.bar.tint).toBe('dark')
    expect(Object.keys(darkGlass.bar).sort()).toEqual(Object.keys(glass.bar).sort())
  })

  it('carries primary and secondary text at AA over every dark surface', () => {
    for (const bg of [darkSurface.canvas, darkSurface.card, darkSurface.subtle]) {
      const bar = composite(darkGlass.bar.wash, bg)
      expect(contrast(darkText.primary, bar)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(darkText.secondary, bar)).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it('the theme hands the bar its mode', () => {
    expect(themes.orange.glass.bar).toBe(glass.bar)
    expect(themes.orangeDark.glass.bar).toBe(darkGlass.bar)
  })
})

const SRC = path.resolve(__dirname, '../../..')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return [full]
  })
}

describe('structure', () => {
  const files = walk(SRC)

  it('every Modal surface has a theme-function stylesheet with no light-only colour', () => {
    const modalViews = files.filter(f => f.endsWith('.view.tsx') && readFileSync(f, 'utf8').includes('<Modal'))
    expect(modalViews.length).toBeGreaterThanOrEqual(4)
    const offenders = modalViews.flatMap(view => {
      const style = view.replace(/\.view\.tsx$/, '.style.tsx')
      const source = readFileSync(style, 'utf8')
      const problems = [
        /StyleSheet\.create\(\s*\(?theme/.test(source) ? '' : 'static StyleSheet.create',
        /\bglassFx\b|\bcolors\b|\bneutral\[/.test(source) ? 'light-only colour import' : '',
      ].filter(Boolean)
      return problems.map(p => `${path.relative(SRC, style)}: ${p}`)
    })
    expect(offenders).toEqual([])
  })

  it('the root layout paints the status bar and canvas from the theme', () => {
    const layout = readFileSync(path.join(SRC, 'app/_layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/style="dark"/)
    expect(layout).not.toMatch(/[^.]surface\.canvas/)
    expect(layout).toContain('theme.surface.canvas')
  })

  it('the Profile list takes its dividers and fills from the theme', () => {
    const source = readFileSync(path.join(SRC, 'features/tabs/profile.style.tsx'), 'utf8')
    expect(source).not.toMatch(/neutral\[/)
  })
})
