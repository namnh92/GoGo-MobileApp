import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { fontFamily, glyph, type } from '../tokens'

/**
 * GoGo-MobileApp#142. The scale is six sizes; it stops being a scale the moment
 * a screen writes its own number. There were 162 of those, and each one looked
 * harmless where it was written.
 *
 * Glyph sizes are exempt from the *scale*, not from the rule: an emoji is a
 * picture sized with `fontSize`, so it gets its own token set rather than a
 * literal.
 *
 * #294 embeds Inter and makes weight part of the style: each of the seven
 * styles names a face, and none names a `fontWeight`. A weight next to a face
 * makes Android synthesise a bold from the wrong file and iOS silently pick a
 * different one, so the token carries the face and nothing else.
 */
const SRC = path.resolve(__dirname, '../../..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : []
  })
}

function offenders(pattern: RegExp): string[] {
  return walk(SRC)
    .filter(file => !file.endsWith(path.join('shared', 'ui', 'tokens.ts')))
    .filter(file => !file.includes('__tests__'))
    .flatMap(file =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({
          // POSIX separators regardless of host, so the allowlist below matches on Windows too.
          file: path.relative(SRC, file).split(path.sep).join('/'),
          line: i + 1,
          text: line.trim(),
        }))
        .filter(row => pattern.test(row.text)),
    )
    .map(row => `${row.file}:${row.line} ${row.text}`)
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

  it('every style names an embedded Inter face and no weight', () => {
    const faces = new Set<string>(Object.values(fontFamily))
    for (const [name, style] of Object.entries(type)) {
      expect(faces.has(style.fontFamily), `${name} names a face outside assets/fonts`).toBe(true)
      expect(style, `${name} carries a fontWeight`).not.toHaveProperty('fontWeight')
    }
    // `label` is `bodySmall` at button weight: same size, a heavier face.
    expect(type.label.fontFamily).toBe(fontFamily.semiBold)
    expect(type.bodySmall.fontFamily).toBe(fontFamily.regular)
  })

  it('no source file writes a font size', () => {
    /**
     * #298: not even a token. Text takes a size from `<Text variant>`, a glyph
     * from `<Glyph size>` (whose styles live in tokens.ts), so `fontSize:` in a
     * screen means a size chosen outside the scale. The one exception is a size
     * computed from a component prop — an avatar's initials scale with the
     * avatar — and each of those is listed here with its count.
     */
    const computedFromProp: Record<string, number> = {
      // ScaledText (AvatarCircle): emoji and initials scale with the avatar's `size` prop.
      'shared/ui/text.tsx': 2,
    }
    const counts: Record<string, number> = {}
    const rows = offenders(/fontSize\s*:/)
    for (const row of rows) {
      const file = row.slice(0, row.indexOf(':'))
      counts[file] = (counts[file] ?? 0) + 1
    }
    const unexpected = rows.filter(row => {
      const file = row.slice(0, row.indexOf(':'))
      return counts[file] !== computedFromProp[file]
    })
    expect(unexpected).toEqual([])
    // The exception list may only shrink: a listed file without the computed size is stale.
    expect(Object.keys(computedFromProp).filter(file => !(file in counts))).toEqual([])
  })

  it('no source file names a font family', () => {
    // A face is chosen by spreading a `type.*` style. The monospace invite code
    // was the one exception; it went when the `mono` style was dropped (owner,
    // 2026-09-24).
    expect(offenders(/fontFamily:/)).toEqual([])
  })

  it('no source file adds a fontWeight', () => {
    // #298 replaced the #142–#297 ratchet table with a ban: weight is the face
    // a `type.*` style names, so a heavier line is a different variant
    // (`label`, `title2`), never a `fontWeight` next to one.
    expect(offenders(/fontWeight\s*:/)).toEqual([])
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
