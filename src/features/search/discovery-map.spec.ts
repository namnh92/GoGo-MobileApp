import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { discoveryMap } from './discovery-map'

const places = [
  { id: 'top', name: 'Top result', lat: 21, lng: 105 },
  { id: 'second', name: 'Second result', lat: 10, lng: 106 },
]
const area = { datasetVersion: 'current', provinceCode: 'from-api', provinceName: 'City', communeCode: null, communeName: null }

describe('O-4 single marker and camera', () => {
  it('marks and zooms on shared GPS, including an empty result set', () => {
    for (const results of [places, []]) {
      const map = discoveryMap({ status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }, results, 'Current location')
      expect(map.pins).toEqual([{ id: 'discovery-current-location', lat: 10.77, lng: 106.7, title: 'Current location' }])
      expect(map.region).toEqual({ latitude: 10.77, longitude: 106.7, latitudeDelta: 0.01, longitudeDelta: 0.01 })
    }
  })

  it.each(['selected_area', 'profile_area', 'default_area'] as const)('marks only top-1 and centres there for %s', source => {
    const map = discoveryMap({ status: 'ready', source, area }, places, 'Current location')
    expect(map.pins).toEqual([{ id: 'top', title: 'Top result', lat: 21, lng: 105 }])
    expect(map.region).toMatchObject({ latitude: 21, longitude: 105 })
  })

  it('uses top-1 when there is no shared location', () => {
    const scope: DiscoveryScope = { status: 'ready', source: 'none', reason: 'no_area' }
    expect(discoveryMap(scope, places, '').pins.map(pin => pin.id)).toEqual(['top'])
    expect(discoveryMap(scope, [], '')).toEqual({ pins: [], region: null })
    // Missing top-1 coordinates is a fallback, never a different ranked place.
    expect(discoveryMap(scope, [{ ...places[0], lat: null }, places[1]], '').pins).toEqual([])
  })
})
