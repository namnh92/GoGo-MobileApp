import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ratchet for F-03 (PR #421): a screen must not use a static light colour.
 * A static light colour is `neutral[`, `glassFx.` or a bare `surface.*` (not
 * `theme.surface.*`) in a `.style.tsx`, a `.view.tsx` or a route file. Such a
 * value is resolved once at import and cannot follow the device into dark.
 *
 * ALLOWLIST holds today's known uses, with a count per file. A new use, or a
 * file not listed, fails. An entry whose count is higher OR lower than the real
 * count also fails, so the list can only shrink: fix a use, then lower or
 * delete its entry in the same change.
 *
 * THE LIST MUST BE EMPTY BEFORE re-design MERGES TO develop.
 */
const ALLOWLIST: Record<string, number> = {
  'features/account/account.style.tsx': 3,
  'features/account/account.view.tsx': 2,
  'features/account/date-of-birth.style.tsx': 3,
  'features/account/date-of-birth.view.tsx': 1,
  'features/active-date/active-date.style.tsx': 3,
  'features/active-date/checkin-sheet.style.tsx': 16,
  'features/active-date/checkin-sheet.view.tsx': 2,
  'features/active-date/date-finished.style.tsx': 3,
  'features/auth/sign-in.style.tsx': 5,
  'features/auth/sign-in.view.tsx': 3,
  'features/create-date/create-budget.style.tsx': 1,
  'features/create-date/create-budget.view.tsx': 1,
  'features/create-date/create-mood.style.tsx': 1,
  'features/create-date/create-time.style.tsx': 2,
  'features/create-date/create-type.style.tsx': 2,
  'features/create-date/group-setup.style.tsx': 2,
  'features/create-date/group-setup.view.tsx': 1,
  'features/date-plan/date-plan.style.tsx': 8,
  'features/date-plan/place-detail.style.tsx': 11,
  'features/date-plan/place-detail.view.tsx': 2,
  'features/date-plan/place-reviews.style.tsx': 3,
  'features/date-plan/plan-edit.style.tsx': 1,
  'features/gogo-room/gogo-room.style.tsx': 1,
  'features/gogo-room/guest-join.style.tsx': 4,
  'features/gogo-room/guest-join.view.tsx': 1,
  'features/gogo-room/guest-replace-notice.style.tsx': 1,
  'features/gogo-room/join-by-code.style.tsx': 3,
  'features/gogo-room/join-by-code.view.tsx': 2,
  'features/gogo-room/room-manage.style.tsx': 4,
  'features/home/home.style.tsx': 3,
  'features/matching/match-result.style.tsx': 11,
  'features/matching/matching.style.tsx': 2,
  'features/matching/swipe.style.tsx': 3,
  'features/matching/swipe.view.tsx': 1,
  'features/notifications/notification-switch.view.tsx': 1,
  'features/onboarding/onboarding.style.tsx': 1,
  'features/onboarding/splash.style.tsx': 2,
  'features/onboarding/splash.view.tsx': 1,
  'features/place-import/import.style.tsx': 5,
  'features/place-import/import.view.tsx': 4,
  'features/review/my-reviews.style.tsx': 3,
  'features/review/my-reviews.view.tsx': 1,
  'features/review/review.style.tsx': 1,
  'features/review/review.view.tsx': 1,
  'features/review/shared-result.style.tsx': 1,
  'features/search/search.style.tsx': 7,
  'features/search/search.view.tsx': 3,
  'features/settings/device-promotions.view.tsx': 1,
  'features/settings/tracking-consent.view.tsx': 1,
  'shared/administrative/administrative-picker.style.tsx': 1,
  'shared/observability/root-error-boundary.style.tsx': 1,
  'shared/ui/button.style.tsx': 1,
  'shared/ui/place-card.style.tsx': 1,
  'shared/ui/skeleton.style.tsx': 1,
}

const SRC = path.resolve(__dirname, '../../..')
const PATTERN = /\bneutral\[|\bglassFx\.|(?<![.\w])surface\.\w+/g

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : walk(full)
    return [full]
  })
}

function isScreenFile(rel: string): boolean {
  return /\.(style|view)\.tsx$/.test(rel) || rel.startsWith('app/')
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function measure(): Record<string, number> {
  const found: Record<string, number> = {}
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/')
    if (!isScreenFile(rel) || !/\.tsx?$/.test(rel)) continue
    const count = (stripComments(readFileSync(file, 'utf8')).match(PATTERN) ?? []).length
    if (count > 0) found[rel] = count
  }
  return found
}

describe('static light colours in screens (ratchet)', () => {
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
