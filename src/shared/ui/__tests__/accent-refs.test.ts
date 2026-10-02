import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { colors, glass } from '../tokens'

/**
 * GoGo-MobileApp#297 (#293 §6). The accent is a theme role: a screen that
 * names the old coral by hand stays coral when the user picks green, and
 * nothing on screen says why. Every accent surface reads `theme.accent.*`
 * (`StyleSheet.create(theme => …)` or `useUnistyles()`), and this file keeps
 * it that way — the same check as the issue's acceptance grep, run on every
 * `pnpm test`, tests included.
 */
const SRC = path.resolve(__dirname, '../../..')
const EXEMPT = new Set(['shared/ui/tokens.ts', 'shared/ui/theme.ts'])
// Spelled with escapes so this file does not match itself.
const CORAL = /brand\.(coral|coralDeep|coralInk|coralBright|coralSoft|coralGhost)\b|tint\.coral\b/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(full) ? [full] : []
  })
}

describe('accent references (#297)', () => {
  it('no source file names the coral accent — accent colours come from the theme', () => {
    const offenders = walk(SRC).flatMap(file => {
      const rel = path.relative(SRC, file).split(path.sep).join('/')
      if (EXEMPT.has(rel)) return []
      return readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (CORAL.test(line) ? [`${rel}:${i + 1} ${line.trim()}`] : []))
    })
    expect(offenders).toEqual([])
  })

  it('the palette no longer carries a coral to reach for', () => {
    expect(Object.keys(colors.brand).filter(key => key.startsWith('coral'))).toEqual([])
    expect(glass.tint).not.toHaveProperty('coral')
  })
})
