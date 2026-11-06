import { describe, expect, it } from 'vitest'
import { fitIllustration, illustrationEnvelope, rotatedBounds, type IllustrationRect } from './onboarding-layout'
describe('R3/D7 illustration fit', () => {
  it.each([[320, 568], [360, 640], [390, 884], [430, 932]])('fits complete art inside %ix%i safe areas without changing aspect', (width, height) => {
    for (const artHeight of [320, 340, 400, 480]) {
      const fit = fitIllustration(width, height, 47, 34, artHeight)
      expect(fit.width).toBeLessThanOrEqual(width - 40)
      expect(fit.height).toBeLessThanOrEqual((height - 81) * 0.48 + 0.001)
      expect(fit.width / fit.height).toBeCloseTo(350 / artHeight, 8)
      expect(fit.scale).toBeGreaterThan(0)
    }
  })
  it('never overflows when safe areas consume the available screen', () => {
    expect(fitIllustration(320, 81, 47, 34, 400)).toEqual({ scale: 0, width: 0, height: 0 })
  })
})


describe('rotated illustration reservation', () => {
  function corners(rect: IllustrationRect) {
    const radians = (rect.rotation ?? 0) * Math.PI / 180
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return [-1, 1].flatMap(dx => [-1, 1].map(dy => ({
      x: cx + dx * rect.width / 2 * Math.cos(radians) - dy * rect.height / 2 * Math.sin(radians),
      y: cy + dx * rect.width / 2 * Math.sin(radians) + dy * rect.height / 2 * Math.cos(radians),
    })))
  }
  it.each([-8, 0, 9])('bounds every corner at %i degrees', rotation => {
    const rect = { x: 2, y: 32, width: 224, height: 560, rotation }
    const points = corners(rect)
    const bounds = rotatedBounds(rect)
    expect(bounds.x).toBeCloseTo(Math.min(...points.map(p => p.x)), 10)
    expect(bounds.y).toBeCloseTo(Math.min(...points.map(p => p.y)), 10)
    expect(bounds.x + bounds.width).toBeCloseTo(Math.max(...points.map(p => p.x)), 10)
    expect(bounds.y + bounds.height).toBeCloseTo(Math.max(...points.map(p => p.y)), 10)
  })
  it('retains the baseline reservation without measurements or for contained cards', () => {
    expect(illustrationEnvelope([])).toEqual({ x: 0, y: 0, width: 350, height: 340 })
    expect(illustrationEnvelope([{ x: 47, y: 30, width: 256, height: 280 }])).toEqual({ x: 0, y: 0, width: 350, height: 340 })
  })
  it.each([[320, 568], [360, 640], [390, 884], [430, 932]])('reserves enlarged rotated cards and fits the union on %ix%i', (width, height) => {
    const rectangles = [
      { x: 2, y: 32, width: 224, height: 560, rotation: -8 },
      { x: 124, y: 56, width: 224, height: 600, rotation: 9 },
      { x: 47, y: -130, width: 256, height: 600 },
    ]
    const union = illustrationEnvelope(rectangles)
    expect(union.height).toBeGreaterThan(790)
    expect(union.width).toBeGreaterThan(350)
    for (const point of rectangles.flatMap(corners)) {
      expect(point.x - union.x).toBeGreaterThanOrEqual(-0.000001)
      expect(point.y - union.y).toBeGreaterThanOrEqual(-0.000001)
      expect(point.x - union.x).toBeLessThanOrEqual(union.width + 0.000001)
      expect(point.y - union.y).toBeLessThanOrEqual(union.height + 0.000001)
    }
    const fit = fitIllustration(width, height, 47, 34, union.height, union.width)
    expect(fit.width).toBeLessThanOrEqual(width - 40)
    expect(fit.height).toBeLessThanOrEqual((height - 81) * 0.48 + 0.000001)
    expect(fit.width / fit.height).toBeCloseTo(union.width / union.height, 10)
  })
})
