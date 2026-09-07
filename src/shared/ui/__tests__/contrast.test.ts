import { describe, expect, it } from 'vitest'

import { colors } from '../tokens'

/**
 * GoGo-MobileApp#141. Contrast is a number, so it can be a test rather than an
 * opinion someone raises in review.
 *
 * These three failed at once and none of them looked wrong: `neutral[500]` at
 * 3.78 on the ivory background carried most of the metadata in the product,
 * `neutral[300]` at 1.61 was the placeholder colour, and the primary CTA's
 * gradient started light enough to put white text at 4.09. WCAG 2.2 AA wants
 * 4.5 for body text, 3.0 for large text and UI boundaries.
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
  })
})
