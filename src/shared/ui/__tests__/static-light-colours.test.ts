import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ratchet for F-01 (PR #421, finding F-03/F-05): a screen or shared component
 * must not use a static light colour. Every `.tsx` under `src`, outside
 * `__tests__`, is scanned, `src/shared/ui` included. A use is:
 *   - `neutral[`, `colors.brand`, `brand.*` from a destructure, `mapColors.*`,
 *     or a colour literal (`#RGB[A]`, `rgb(a)(`);
 *   - `glassFx.` or `surface.`, `border.`, `text.`, `status.` read from a name
 *     imported from `@/shared/ui/tokens`. `theme.surface.*` is not a use: it
 *     goes through the theme and follows the device into dark.
 * Such a value is resolved once at import and cannot follow the device.
 *
 * ALLOWLIST holds today's known uses, with a count per file. A new use, or a
 * file not listed, fails. An entry whose count is higher OR lower than the real
 * count also fails, so the list can only shrink: fix a use, then lower or
 * delete its entry in the same change.
 *
 * THE LIST MUST BE EMPTY BEFORE re-design MERGES TO develop.
 */
const ALLOWLIST: Record<string, number> = {
  'features/account/account.style.tsx': 4,
  'features/account/account.view.tsx': 2,
  'features/account/date-of-birth.style.tsx': 3,
  'features/account/date-of-birth.view.tsx': 1,
  'features/active-date/active-date.style.tsx': 5,
  'features/active-date/checkin-sheet.style.tsx': 20,
  'features/active-date/checkin-sheet.view.tsx': 2,
  'features/active-date/date-finished.style.tsx': 3,
  'features/date-plan/place-detail.style.tsx': 12,
  'features/date-plan/place-detail.view.tsx': 3,
  'features/date-plan/place-reviews.style.tsx': 3,
  'features/gogo-room/gogo-room.style.tsx': 1,
  'features/gogo-room/gogo-room.view.tsx': 4,
  'features/gogo-room/guest-join.style.tsx': 4,
  'features/gogo-room/guest-join.view.tsx': 1,
  'features/gogo-room/guest-replace-notice.style.tsx': 2,
  'features/gogo-room/join-by-code.style.tsx': 3,
  'features/gogo-room/join-by-code.view.tsx': 2,
  'features/gogo-room/room-manage.style.tsx': 4,
  'features/matching/match-result.style.tsx': 13,
  'features/matching/matching.style.tsx': 2,
  'features/matching/swipe.style.tsx': 4,
  'features/matching/swipe.view.tsx': 4,
  'features/notifications/notification-switch.view.tsx': 1,
  'features/place-import/import.style.tsx': 8,
  'features/place-import/import.view.tsx': 4,
  'features/review/my-reviews.style.tsx': 3,
  'features/review/my-reviews.view.tsx': 1,
  'features/review/review.style.tsx': 1,
  'features/review/review.view.tsx': 1,
  'features/settings/device-promotions.view.tsx': 1,
  'features/settings/tracking-consent.view.tsx': 1,
  'shared/administrative/administrative-picker.style.tsx': 1,
  'shared/observability/root-error-boundary.style.tsx': 1,
}

const SRC = path.resolve(__dirname, '../../..')
const TOKENS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@\/shared\/ui\/tokens['"]/g
const ROLES = ['glassFx', 'surface', 'border', 'text', 'status'] as const
const ALWAYS = [/\bneutral\[/g, /\bcolors\.brand\b/g, /(?<![.\w])brand\.\w+/g, /\bmapColors\.\w+/g, /(['"`])#[0-9a-fA-F]{3,8}\1/g, /\brgba?\(/g]

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return [full]
  })
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function countUses(raw: string): number {
  const source = stripComments(raw)
  const imported = new Set(
    [...source.matchAll(TOKENS_IMPORT)].flatMap(m => m[1]!.split(',').map(n => n.trim().split(/\s+as\s+/).pop()!)),
  )
  let count = 0
  for (const re of ALWAYS) count += (source.match(re) ?? []).length
  for (const role of ROLES) {
    if (!imported.has(role)) continue
    count += (source.match(new RegExp(`(?<![.\\w])${role}\\.\\w+`, 'g')) ?? []).length
  }
  return count
}

function measure(): Record<string, number> {
  const found: Record<string, number> = {}
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/')
    if (!rel.endsWith('.tsx')) continue
    const count = countUses(readFileSync(file, 'utf8'))
    if (count > 0) found[rel] = count
  }
  return found
}

describe('static light colours (ratchet)', () => {
  const found = measure()

  it('no file has a use beyond its allowlist count', () => {
    const over = Object.entries(found)
      .filter(([file, n]) => n > (ALLOWLIST[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} uses, allowed ${ALLOWLIST[file] ?? 0}`)
    expect(over).toEqual([])
  })

  it('no allowlist entry is stale: counts match exactly, so the list only shrinks', () => {
    const stale = Object.entries(ALLOWLIST)
      .filter(([file, n]) => (found[file] ?? 0) !== n)
      .map(([file, n]) => `${file}: allowlist ${n}, found ${found[file] ?? 0}`)
    expect(stale).toEqual([])
  })
})
