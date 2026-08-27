import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A control with no role is announced by VoiceOver as plain text, so a screen
 * reader user cannot tell it is actionable. That is a P0 accessibility defect
 * under the quality gates, and it is easy to reintroduce — hence a static
 * guard rather than a one-off audit.
 */

const SOURCE_ROOT = join(__dirname, '..', '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

/** The opening tag only — props after the first `>` belong to the children. */
function openingTags(source: string, component: string): { tag: string; line: number }[] {
  const tags: { tag: string; line: number }[] = []
  const opener = new RegExp(`<${component}\\b`, 'g')
  let match: RegExpExecArray | null
  while ((match = opener.exec(source))) {
    let end = match.index
    while (end < source.length && !(source[end] === '>' && source[end - 1] !== '=')) end += 1
    tags.push({ tag: source.slice(match.index, end), line: source.slice(0, match.index).split('\n').length })
  }
  return tags
}

describe('accessibility', () => {
  const files = sourceFiles(SOURCE_ROOT)

  it('scans the whole app, not an empty list', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('gives every control a role or a label', () => {
    const offenders = files.flatMap(file =>
      openingTags(readFileSync(file, 'utf8'), 'Pressable')
        .filter(({ tag }) => !/accessibilityRole|accessibilityLabel/.test(tag))
        // A modal backdrop is a dismiss surface, not a control worth announcing.
        .filter(({ tag }) => !tag.includes('styles.backdrop'))
        .map(({ line }) => `${file.replace(SOURCE_ROOT, 'src')}:${line}`),
    )
    expect(offenders).toEqual([])
  })

  it('keeps every control under 44pt reachable through a hit slop', () => {
    const SMALL = /\b(?:height|width):\s*(?:[0-9]|[1-3][0-9]|4[0-3])\b/
    const offenders = files
      .filter(file => file.endsWith('.style.tsx') || file.endsWith('primitives.tsx'))
      .flatMap(file => {
        const source = readFileSync(file, 'utf8')
        const viewFile = file.replace('.style.tsx', '.view.tsx')
        let view = ''
        try {
          view = readFileSync(viewFile, 'utf8')
        } catch {
          view = source
        }
        return [...source.matchAll(/^\s*(\w*(?:Btn|Button|Toggle)\w*):\s*\{([^}]*)\}/gm)]
          .filter(([, , body]) => SMALL.test(body))
          // A shadow's offset is not a touch target.
          .filter(([, name]) => !/Shadow$/.test(name))
          .filter(([, name]) => {
            // Reachable if the control that wears this style widens its slop.
            const used = new RegExp(`styles\\.${name}\\b`)
            return !openingTags(view, 'Pressable').some(
              ({ tag }) => used.test(tag) && tag.includes('hitSlop'),
            )
          })
          .map(([, name]) => `${file.replace(SOURCE_ROOT, 'src')}: ${name}`)
      })
    expect(offenders).toEqual([])
  })
})
