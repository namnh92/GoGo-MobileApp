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
        .map((line, i) => ({ file: path.relative(SRC, file), line: i + 1, text: line.trim() }))
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

  it('no source file hard-codes a font size', () => {
    expect(offenders(/fontSize: \d/)).toEqual([])
  })

  it('no source file names a font family', () => {
    // A face is chosen by spreading a `type.*` style. The monospace invite code
    // was the one exception; it went when the `mono` style was dropped (owner,
    // 2026-09-24).
    expect(offenders(/fontFamily:/)).toEqual([])
  })

  it('no source file adds a fontWeight the type scale did not give it', () => {
    /**
     * Ratchet, not a ban yet. These overrides predate the embedded face and
     * are removed screen by screen in #295–#298 (a `body` at `'700'` is not a
     * style on the scale; each becomes `label`, `title2`, or stays Regular —
     * a design call per line, not a mechanical rewrite). Until then a file may
     * not gain one, and a file not listed here may not have any. Lower a
     * count when you remove an override; #298 deletes the table.
     */
    const allowed: Record<string, number> = {
      'app/(tabs)/_layout.tsx': 1,
      'features/account/account.style.tsx': 2,
      'features/account/date-of-birth.style.tsx': 1,
      'features/account/profile-defaults.style.tsx': 1,
      'features/active-date/active-date.style.tsx': 3,
      'features/active-date/checkin-sheet.style.tsx': 6,
      'features/active-date/date-finished.style.tsx': 1,
      'features/auth/sign-in.style.tsx': 2,
      'features/create-date/create-location.style.tsx': 1,
      'features/create-date/create-time.style.tsx': 2,
      'features/create-date/group-setup.style.tsx': 2,
      'features/date-plan/date-plan.style.tsx': 2,
      'features/date-plan/place-detail.style.tsx': 4,
      'features/date-plan/plan-edit.style.tsx': 1,
      'features/gogo-room/gogo-room.style.tsx': 5,
      'features/gogo-room/guest-join.style.tsx': 1,
      'features/gogo-room/room-manage.style.tsx': 3,
      'features/home/home.style.tsx': 3,
      'features/matching/match-result.style.tsx': 5,
      'features/matching/matching.style.tsx': 2,
      'features/matching/swipe.style.tsx': 4,
      'features/notifications/notification-switch.style.tsx': 2,
      'features/notifications/notifications.style.tsx': 1,
      'features/onboarding/onboarding.style.tsx': 1,
      'features/place-import/import.style.tsx': 10,
      'features/review/my-reviews.style.tsx': 1,
      'features/review/review.style.tsx': 2,
      'features/review/shared-result.style.tsx': 2,
      'features/search/search.style.tsx': 8,
      'features/settings/location-permission.style.tsx': 1,
      'features/tabs/plans.style.tsx': 1,
      'features/tabs/profile.style.tsx': 3,
      'features/tabs/saved.style.tsx': 1,
      'shared/ui/async-state.style.tsx': 1,
      'shared/ui/place-card.style.tsx': 3,
      'shared/ui/primitives.tsx': 7,
    }

    const counts: Record<string, number> = {}
    for (const row of offenders(/fontWeight:/)) {
      const file = row.slice(0, row.indexOf(':'))
      counts[file] = (counts[file] ?? 0) + 1
    }

    const overBudget = Object.entries(counts)
      .filter(([file, count]) => count > (allowed[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (allowed ${allowed[file] ?? 0})`)
    expect(overBudget).toEqual([])

    // The table may only shrink: an entry whose file is clean is stale.
    const stale = Object.keys(allowed).filter(file => !(file in counts))
    expect(stale).toEqual([])
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
