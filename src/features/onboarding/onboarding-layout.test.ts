import { describe, expect, it } from 'vitest'
import { fitIllustration } from './onboarding-layout'
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
