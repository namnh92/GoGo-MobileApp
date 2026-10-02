import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * GoGo-MobileApp#298 (#293 §4, RULE-DS "no colour literals outside the tokens
 * file"). A hex or rgba written in a screen is a colour the theme cannot reach
 * and the contrast test never measures. Colours live in `tokens.ts` (static
 * roles) and `theme.ts` (the four accent themes); everything else reads them.
 *
 * A hex is matched as a quoted string: `#293` in a comment is an issue number,
 * `'#293'` in code is a colour.
 */
const SRC = path.resolve(__dirname, '../../..')
const EXEMPT = new Set(['shared/ui/tokens.ts', 'shared/ui/theme.ts'])
// Built from parts so the patterns do not match this file's own source.
const HEX = new RegExp(`['"\`]${'#'}[0-9a-fA-F]{3,8}['"\`]`)
const RGBA = new RegExp(`\\b${'rgb'}a?\\(`)
const HSLA = new RegExp(`\\b${'hsl'}a?\\(`)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return /\.(ts|tsx)$/.test(full) ? [full] : []
  })
}

function offenders(pattern: RegExp): string[] {
  return walk(SRC).flatMap(file => {
    const rel = path.relative(SRC, file).split(path.sep).join('/')
    if (EXEMPT.has(rel)) return []
    return readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => (pattern.test(line) ? [`${rel}:${i + 1} ${line.trim()}`] : []))
  })
}

describe('colour literals (#298)', () => {
  it('no source file writes a hex colour', () => {
    expect(offenders(HEX)).toEqual([])
  })

  it('no source file writes an rgb/rgba/hsl colour', () => {
    expect([...offenders(RGBA), ...offenders(HSLA)]).toEqual([])
  })
})
