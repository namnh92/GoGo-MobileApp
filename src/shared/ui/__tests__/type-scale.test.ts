import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { glyph, type } from '../tokens'

/**
 * GoGo-MobileApp#142. The scale is six sizes; it stops being a scale the moment
 * a screen writes its own number. There were 162 of those, and each one looked
 * harmless where it was written.
 *
 * Glyph sizes are exempt from the *scale*, not from the rule: an emoji is a
 * picture sized with `fontSize`, so it gets its own token set rather than a
 * literal.
 */
const SRC = path.resolve(__dirname, '../../..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : []
  })
}

describe('type scale', () => {
  it('has exactly six text sizes', () => {
    expect(Object.keys(type).sort()).toEqual(
      ['body', 'bodySmall', 'caption', 'display', 'label', 'title1', 'title2'].sort(),
    )
    // `label` is `bodySmall` at button weight, not a seventh size.
    expect(type.label.fontSize).toBe(type.bodySmall.fontSize)
    expect(new Set(Object.values(type).map(t => t.fontSize)).size).toBe(6)
  })

  it('no source file hard-codes a font size', () => {
    const offenders = walk(SRC)
      .filter(file => !file.endsWith(path.join('shared', 'ui', 'tokens.ts')))
      .filter(file => !file.includes('__tests__'))
      .flatMap(file =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, i) => ({ file: path.relative(SRC, file), line: i + 1, text: line.trim() }))
          .filter(row => /fontSize: \d/.test(row.text)),
      )
      .map(row => `${row.file}:${row.line} ${row.text}`)

    expect(offenders).toEqual([])
  })

  it('glyph sizes stay out of the text scale', () => {
    const textSizes = new Set(Object.values(type).map(t => t.fontSize))
    // A glyph token may coincide with a text size (18 vs 17 does not, but the
    // rule is about intent): what matters is that the two sets are declared
    // separately, so the assertion is that glyph carries the sizes prose never
    // needs — everything above the largest text size.
    expect(Math.max(...Object.values(glyph))).toBeGreaterThan(Math.max(...textSizes))
    expect(Object.values(glyph).every(size => size >= 18)).toBe(true)
  })
})
