import { describe, expect, it } from 'vitest'

import { ACCENTS, themes } from '../theme'
import { accents, colors, status, text } from '../tokens'

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

const { neutral, brand } = colors
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

  it.each([
    ['gradient start', brand.coralDeep],
    ['gradient end', brand.coralInk],
  ])('white on the primary CTA %s reads at AA', (_label, background) => {
    expect(contrast(neutral[0], background)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('keeps coral usable as an accent on light surfaces', () => {
    // Not AA for body text, and not used for it — headings and icons only.
    expect(contrast(brand.coral, neutral[0])).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it('neutral[300] stays out of the text palette', () => {
    // Kept deliberately: it is the line/disabled colour. The assertion is here so
    // that anyone tempted to use it for text sees why it is not a candidate.
    expect(contrast(neutral[300], IVORY)).toBeLessThan(AA_LARGE)
    expect(text.tertiary).toBe(neutral[300])
  })
})

describe('accent themes (#293 §6)', () => {
  it('registers exactly the four spec themes', () => {
    expect(Object.keys(accents).sort()).toEqual([...ACCENTS].sort())
    expect(Object.keys(themes).sort()).toEqual([...ACCENTS].sort())
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
