import { describe, expect, it } from 'vitest'

import { regionForPins, type MapPin } from '../map-region'

function pin(id: string, lat: number, lng: number): MapPin {
  return { id, lat, lng, title: id }
}

describe('regionForPins', () => {
  it('has nothing to show for no pins, so the caller can render a fallback', () => {
    expect(regionForPins([])).toBeNull()
  })

  it('centres on the pins', () => {
    const region = regionForPins([pin('a', 10.8, 106.7), pin('b', 10.6, 106.9)])
    expect(region?.latitude).toBeCloseTo(10.7, 6)
    expect(region?.longitude).toBeCloseTo(106.8, 6)
  })

  it('leaves air around the outermost pins rather than cropping them', () => {
    const region = regionForPins([pin('a', 10.8, 106.7), pin('b', 10.6, 106.9)])
    // 0.2 of spread, widened so the edge pins are not on the frame.
    expect(region?.latitudeDelta).toBeGreaterThan(0.2)
    expect(region?.longitudeDelta).toBeGreaterThan(0.2)
  })

  it('opens a neighbourhood-sized window on a single pin instead of zooming to a point', () => {
    const region = regionForPins([pin('only', 10.8, 106.7)])
    expect(region?.latitudeDelta).toBeGreaterThan(0)
    expect(region?.longitudeDelta).toBeGreaterThan(0)
  })

  it('does the same when every pin shares a coordinate', () => {
    const region = regionForPins([pin('a', 10.8, 106.7), pin('b', 10.8, 106.7)])
    expect(region?.latitudeDelta).toBeGreaterThan(0)
  })
})
