import { describe, expect, it } from 'vitest'
import { avatarGeometry, DEFAULT_AVATAR_ADJUSTMENT } from '../avatar-crop'

describe('avatar output matches the circular viewport', () => {
  it('centers a square crop inside a landscape image at the default zoom', () => {
    const g = avatarGeometry(800, 600, 350, DEFAULT_AVATAR_ADJUSTMENT)
    expect(g.crop).toEqual({ originX: 208, originY: 108, width: 384, height: 384 })
  })
  it.each([0, 90, 180, 270])('clamps extreme panning to image bounds after rotation %s', rotation => {
    for (const zoom of [1, 1.25, 2.5]) for (const x of [-10000, 0, 10000]) for (const y of [-10000, 0, 10000]) {
      const { crop } = avatarGeometry(800, 600, 350, { ...DEFAULT_AVATAR_ADJUSTMENT, rotation, zoom, x, y })
      const [w, h] = rotation % 180 ? [600, 800] : [800, 600]
      expect(crop.width).toBe(crop.height)
      expect(crop.originX).toBeGreaterThanOrEqual(0)
      expect(crop.originY).toBeGreaterThanOrEqual(0)
      expect(crop.originX + crop.width).toBeLessThanOrEqual(w)
      expect(crop.originY + crop.height).toBeLessThanOrEqual(h)
    }
  })
  it('uses image coordinates independent of the viewport size', () => {
    expect(avatarGeometry(600, 800, 300, DEFAULT_AVATAR_ADJUSTMENT).crop)
      .toEqual(avatarGeometry(600, 800, 350, DEFAULT_AVATAR_ADJUSTMENT).crop)
  })
})
