import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { enContent, enMessages } from '@/shared/i18n/en'
import { viContent, viMessages } from '@/shared/i18n/vi'

/**
 * GoGo-MobileApp#382 (UI-AI-002), extending the #298 gate. The design system
 * already holds in the primitives; these are the places screens drifted away
 * from it, written as checks so they cannot drift back. The pressed-state rule
 * (colour change only, no scale or opacity) is an ESLint rule in
 * `eslint.config.js`, because it is a shape of code rather than a string.
 */
const SRC = path.resolve(__dirname, '../../..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return /\.(ts|tsx)$/.test(full) ? [full] : []
  })
}

/** A line that is only a comment — prose may name what it replaced. */
const COMMENT = /^\s*(\/\/|\*|\/\*|\{\/\*)/

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/')

/**
 * Emoji, flags and the emoji variation selector. "✓" (U+2713) is not
 * pictographic, so a check that repeats its label's meaning stays allowed.
 */
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u

/** Every string inside a locale content value, however deeply nested. */
function strings(value: unknown, at: string): [string, string][] {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((item, i) => strings(item, `${at}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => strings(item, `${at}.${key}`))
  }
  return []
}

const CATALOGS = [
  ['vi', viMessages, viContent],
  ['en', enMessages, enContent],
] as const

describe('i18n copy carries no emoji (#382)', () => {
  it.each(CATALOGS)('%s: messages and content are words; glyphs come from icons.tsx', (name, messages, content) => {
    const offenders = [...strings(messages, name), ...strings(content, `${name}Content`)]
      .filter(([, value]) => EMOJI.test(value))
      .map(([at, value]) => `${at} ${JSON.stringify(value)}`)
    expect(offenders).toEqual([])
  })

  it('the catalog files themselves carry none — comments included', () => {
    const offenders = ['shared/i18n/en.ts', 'shared/i18n/vi.ts'].flatMap(file =>
      readFileSync(path.join(SRC, file), 'utf8')
        .split('\n')
        .flatMap((line, i) => (EMOJI.test(line) ? [`${file}:${i + 1} ${line.trim()}`] : [])),
    )
    expect(offenders).toEqual([])
  })
})

describe('i18n copy is sentence case (#382)', () => {
  /**
   * A value is shouting when every word of two or more letters is upper case
   * and at least one has three — "LIKE", "RẤT HỢP". Acronyms inside a
   * sentence ("Mở GPS") pass, because the sentence around them does not.
   */
  function shouting(value: string): boolean {
    const words = value.replace(/\{\{[^}]*\}\}/g, ' ').match(/\p{L}{2,}/gu) ?? []
    return words.some(word => word.length >= 3) && words.every(word => word === word.toLocaleUpperCase() && word !== word.toLocaleLowerCase())
  }

  it.each(CATALOGS)('%s: no message is written in capitals', (name, messages) => {
    const offenders = Object.entries(messages)
      .filter(([, value]) => typeof value === 'string' && shouting(value))
      .map(([key, value]) => `${name}:${key} ${JSON.stringify(value)}`)
    expect(offenders).toEqual([])
  })
})

/**
 * CLAUDE.md (#295): glass is for the tab bar and the fixed bottom bars only;
 * cards and fields are solid `surface.card`. `glassFx` survives where its wash
 * sits on a photo or on an accent fill — places a solid card colour would be
 * wrong — and in the ATT consent sheet. The modal sheets #381 moved onto the
 * `Sheet` primitive read `surface.card`. This is a ratchet: a new use fails, and removing one means
 * deleting its line here.
 */
const GLASS_FX_ALLOWED: Record<string, string[]> = {
  // Over a photo.
  'features/matching/swipe.style.tsx': ['borderBright', 'solid'],
  // A fixed bottom bar.
  'features/date-plan/date-plan.style.tsx': ['bar'],
