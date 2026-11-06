import { describe, expect, it } from 'vitest'

import { ACCENTS, themes } from '../theme'
import { accents, colors, glass, status, surface, text } from '../tokens'

/**
 * GoGo-MobileApp#141. Contrast is a number, so it can be a test rather than an
 * opinion someone raises in review.
 *
 * These three failed at once and none of them looked wrong: `neutral[500]` at
 * 3.78 on the ivory background carried most of the metadata in the product,
 * `neutral[300]` at 1.61 was the placeholder colour, and the primary CTA's
 * gradient started light enough to put white text at 4.09. WCAG 2.2 AA wants
 * 4.5 for body text, 3.0 for large text and UI boundaries.
 *
 * #294 adds the four accent themes. The spec's starting values put white on
 * three of them under AA (3.70 / 3.20 / 3.96); the values in `tokens.accents`
 * are those hues darkened until they pass, and this file is what keeps them
 * passing when design re-tunes them.
 */
const AA_TEXT = 4.5
const AA_LARGE = 3

function luminance(hex: string): number {
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  const [r, g, b] = [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const { neutral } = colors
/** The app background, and the reason "on white" alone is not enough. */
const IVORY = neutral[50]
const WHITE = neutral[0]

describe('colour contrast', () => {
  it.each([
    ['neutral[900] on ivory', neutral[900], IVORY],
    ['neutral[700] on ivory', neutral[700], IVORY],
    ['neutral[500] on ivory', neutral[500], IVORY],
    ['neutral[500] on white', neutral[500], neutral[0]],
  ])('%s reads at AA for body text', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  // The coral CTA gradient and the coral accent went with #297: every accent
  // surface now reads `theme.accent.*`, measured per theme below.

  it('white on the swipe "pass" stamp reads at AA — it is status.danger, not the accent (#297)', () => {
    // Under the green theme an accent-coloured "pass" would match the mint
    // "like" stamp beside it; the two must stay apart in every theme.
    expect(contrast(WHITE, status.danger)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('neutral[300] stays out of the text palette', () => {
    // Kept deliberately: it is the line/disabled colour. The assertion is here so
    // that anyone tempted to use it for text sees why it is not a candidate.
    expect(contrast(neutral[300], IVORY)).toBeLessThan(AA_LARGE)
    expect(text.tertiary).toBe(neutral[300])
  })
})

describe('design-system cleanup (#382)', () => {
  it('a UI glyph in text.secondary clears 3:1 on every light surface — the chevron was neutral[300] at 1.8', () => {
    for (const surfaceColor of [surface.card, surface.canvas, surface.subtle]) {
      expect(contrast(text.secondary, surfaceColor)).toBeGreaterThanOrEqual(AA_LARGE)
    }
    expect(contrast(neutral[300], surface.card)).toBeLessThan(AA_LARGE)
  })

  it('a past or completed card on the canvas tone keeps its meta at AA — no fade needed', () => {
    expect(contrast(text.secondary, surface.canvas)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(text.primary, surface.canvas)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('a disabled label is text.secondary on surface.subtle — legible, where text.tertiary was 1.6:1', () => {
    // WCAG exempts inactive controls; the design system still asks they read.
    // 4.12 today: above the 3:1 UI floor, and the same pair as the disabled Button.
    expect(contrast(text.secondary, surface.subtle)).toBeGreaterThanOrEqual(AA_LARGE)
    expect(contrast(text.tertiary, surface.subtle)).toBeLessThan(AA_LARGE)
  })

  it.each(ACCENTS)('%s: the check-in toggle (accent.onSoft on accent.soft) reads at AA', accent => {
    expect(contrast(accents[accent].onSoft, accents[accent].soft)).toBeGreaterThanOrEqual(AA_TEXT)
  })
})

describe('accent themes (#293 §6)', () => {
  it('registers exactly the four spec themes', () => {
    expect(Object.keys(accents).sort()).toEqual([...ACCENTS].sort())
    // Each accent in both modes: the light key and its `Dark` twin (theme-dark.test.ts).
    expect(Object.keys(themes).sort()).toEqual([...ACCENTS, ...ACCENTS.map(a => `${a}Dark`)].sort())
  })

  describe.each(ACCENTS)('%s', accent => {
    const { primary, pressed, soft, onSoft, onAccent } = accents[accent]

    it('reads white text on primary at AA — a filled button, on white and on ivory', () => {
      // The label on a Primary button is `onAccent`, which is white for all four.
      expect(onAccent).toBe(WHITE)
      expect(contrast(onAccent, primary)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('reads primary as text at AA on both light surfaces — links, Ghost and Secondary labels', () => {
      expect(contrast(primary, WHITE)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(primary, IVORY)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('pressed is darker than primary, so a press reads as a press and never loses contrast', () => {
      expect(luminance(pressed)).toBeLessThan(luminance(primary))
      expect(contrast(onAccent, pressed)).toBeGreaterThanOrEqual(contrast(onAccent, primary))
    })

    it('primary reads as an icon or boundary on its own soft wash — never as a label', () => {
      // `soft` is a fill behind an icon (PlanCard's 48pt circle) or a pill
      // behind `text.primary`. Primary-on-soft measures 3.9–4.3 across the four
      // themes: enough for a glyph or an outline (3:1), not for a 13pt label
      // (4.5:1). A component that wants accent-coloured text on `soft` needs a
      // new role that passes this file, not an exception here.
      expect(contrast(primary, soft)).toBeGreaterThanOrEqual(AA_LARGE)
      expect(contrast(text.primary, soft)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('onSoft is the role for accent-coloured text on soft — a selected tab, the host badge', () => {
      // #295. The role the previous test asks for: 13pt SemiBold is not large
      // text, so it needs the full 4.5.
      expect(contrast(onSoft, soft)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(onSoft, WHITE)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it('the theme carries the palette, and the CTA shadow borrows its colour', () => {
      expect(themes[accent].accent).toEqual(accents[accent])
      expect(themes[accent].shadows.cta.shadowColor).toBe(primary)
    })
  })
})

describe('"Đang mở" under the green theme (#293 §6, #297)', () => {
  it('colour alone cannot tell the open label from a green button — so the label carries a dot and no fill', () => {
    // Record, not a pass condition on colour: `status.successText` and the
    // green `accent.primary` are both dark greens (~1.06:1 apart). The spec's
    // fallback applies — the darker success step plus the round dot — and the
    // shape does the separating: a button is a filled pill with white text, the
    // open label is coloured text after a dot on the card surface. The dot is
    // asserted in place-card.spec.tsx; this keeps the reason next to the numbers.
    expect(contrast(status.successText, accents.green.primary)).toBeLessThan(AA_LARGE)
    expect(status.successText).not.toBe(accents.green.primary)
    expect(contrast(status.successText, WHITE)).toBeGreaterThanOrEqual(AA_TEXT)
  })
})

describe('status text (#293 §1)', () => {
  it.each([
    ['success', status.success, status.successText],
    ['warning', status.warning, status.warningText],
    ['danger', status.danger, status.dangerText],
    ['info', status.info, status.infoText],
  ])('%s: the label colour reads at AA where the fill colour does not have to', (_name, fill, label) => {
    expect(contrast(label, WHITE)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(label, IVORY)).toBeGreaterThanOrEqual(AA_TEXT)
    // Darker than its fill: the text is the same hue, only deeper, so a pill
    // and its label still read as one status.
    expect(luminance(label)).toBeLessThan(luminance(fill))
  })

  it.each([
    ['success', status.successText, status.successSoft],
    ['warning', status.warningText, status.warningSoft],
    ['danger', status.dangerText, status.dangerSoft],
    ['info', status.infoText, status.infoSoft],
  ])('%s: the label reads at AA on its own pill — chips and badges (#295)', (_name, label, pill) => {
    // The #294 values measured 3.97–4.36 here; a chip label is 13pt, not large.
    expect(contrast(label, pill)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('the success fill is not a text colour — which is why successText exists', () => {
    expect(contrast(status.success, WHITE)).toBeLessThan(AA_LARGE)
  })
})

describe('glass bar wash (#296, #293 §5)', () => {
  /**
   * Text on the tab bar and the bottom action bars sits on `glass.bar.wash`
   * (`surface.card` at 78 %) over whatever scrolls underneath. Measured with no
   * blur: the blur only averages the backdrop, and on Android there is none, so
   * the wash alone has to carry the 4.5:1 (#296 AC).
   */
  function parseRgba(value: string): { rgb: [number, number, number]; alpha: number } {
    const match = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value)
    if (!match) throw new Error(`not an rgba() token: ${value}`)
    return { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: Number(match[4]) }
  }

  /** Source-over: the wash composited onto an opaque backdrop. */
  function composite(wash: string, backdrop: string): string {
    const { rgb, alpha } = parseRgba(wash)
    const channels = rgb.map((value, index) => {
      const under = parseInt(backdrop.slice(1 + index * 2, 3 + index * 2), 16)
      return Math.round(value * alpha + under * (1 - alpha))
    })
    return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`
  }

  it('the wash is surface.card at 78 %', () => {
    const { rgb, alpha } = parseRgba(glass.bar.wash)
    expect(`#${rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`).toBe(surface.card)
    expect(alpha).toBe(0.78)
  })

  // Light content: a white card, the canvas, and `surface.subtle` — the
  // darkest light surface in the app (skeletons, photo placeholders, disabled
  // fills), so the worst case of "light content running under the bar".
  const LIGHT_BACKDROPS = [
    ['a white card', surface.card],
    ['the canvas', surface.canvas],
    ['surface.subtle (worst light case)', surface.subtle],
  ] as const

  describe.each(LIGHT_BACKDROPS)('over %s', (_label, backdrop) => {
    const bar = composite(glass.bar.wash, backdrop)

    it.each([
      ['text.primary', text.primary],
      ['text.secondary (inactive tab label)', text.secondary],
    ])('%s reads at AA', (_name, fg) => {
      expect(contrast(fg, bar)).toBeGreaterThanOrEqual(AA_TEXT)
    })

    it.each(ACCENTS)('accent.primary of %s reads at AA (active tab label, 11pt — not large text)', accent => {
      expect(contrast(accents[accent].primary, bar)).toBeGreaterThanOrEqual(AA_TEXT)
    })
  })

  it('documents the limit: dark content (a photo) under the wash drops secondary text below AA', () => {
    // Not a pass condition — a record of where the 78 % wash stops being
    // enough, so nobody reads the tests above as "any backdrop". Mid-grey
    // measures 3.92; `neutral[300]` (lines, not areas) 4.47. A screen that
    // scrolls photos under a bar is the case to watch on device.
    expect(contrast(text.secondary, composite(glass.bar.wash, '#808080'))).toBeLessThan(AA_TEXT)
    expect(contrast(text.primary, composite(glass.bar.wash, '#000000'))).toBeGreaterThanOrEqual(AA_TEXT)
  })
})


it.each(Object.values(themes))('discovery small text meets 4.5:1 in $mode', theme => {
  const r = theme.redesign
  for (const [foreground, background] of [[r.ink, r.card], [r.secondary, r.high], [r.violetText, r.violetSoft], [r.primaryText, r.primarySoft], [r.primaryText, r.canvas], [r.white, r.primaryFill]]) {
    expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
  }
})
