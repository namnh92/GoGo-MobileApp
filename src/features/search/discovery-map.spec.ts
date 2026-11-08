import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { regionForPins } from '@/shared/ui/map-region'
import { discoveryMap, viewportSearchScope } from './discovery-map'

const places = [
  { id: 'top', name: 'Top result', lat: 21, lng: 105 },
  { id: 'second', name: 'Second result', lat: 10, lng: 106 },
]
const area = { datasetVersion: 'current', provinceCode: 'from-api', provinceName: 'City', communeCode: null, communeName: null }
const none: DiscoveryScope = { status: 'ready', source: 'none', reason: 'no_area' }

describe('O-4 all loaded markers and independent camera', () => {
  it('centres GPS on the user without turning the user into a place marker', () => {
    const scope: DiscoveryScope = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    for (const results of [places, []]) {
      const map = discoveryMap(scope, results)
      expect(map.pins.map(pin => pin.id)).toEqual(results.map(place => place.id))
      expect(map.showsUserLocation).toBe(true)
      expect(map.region).toEqual({ latitude: 10.77, longitude: 106.7, latitudeDelta: 0.01, longitudeDelta: 0.01 })
    }
  })

  it.each(['selected_area', 'profile_area', 'default_area'] as const)('keeps all markers but centres top-1 for %s', source => {
    const map = discoveryMap({ status: 'ready', source, area }, places)
    expect(map.pins).toEqual(places.map(({ name, ...place }) => ({ ...place, title: name, category: undefined })))
    expect(map.region).toEqual({ latitude: 21, longitude: 105, latitudeDelta: 0.01, longitudeDelta: 0.01 })
    expect(map.showsUserLocation).toBe(false)
  })

  it('centres top-1 without location, fitting usable results only when top-1 has no coordinates', () => {
    expect(discoveryMap(none, places).region).toMatchObject({ latitude: 21, longitude: 105, latitudeDelta: 0.01 })
    const map = discoveryMap(none, [{ ...places[0], lat: null }, places[1], { id: 'third', name: 'Third', lat: 12, lng: 108 }])
    expect(map.pins.map(pin => pin.id)).toEqual(['second', 'third'])
    expect(map.region).toEqual(regionForPins(map.pins))
    expect(discoveryMap(none, [])).toEqual({ pins: [], region: null, showsUserLocation: false })
  })

  it.each([[null, 106], [10, undefined], [NaN, 106], [10, Infinity], [91, 106], [10, -181]])('skips unusable coordinates (%s, %s)', (lat, lng) => {
    expect(discoveryMap(none, [...places, { id: 'bad', name: 'Bad', lat, lng }]).pins).toHaveLength(2)
  })

  it('updates markers when loaded search/filter/area results change', () => {
    expect(discoveryMap(none, places).pins.map(pin => pin.id)).toEqual(['top', 'second'])
    expect(discoveryMap(none, [places[1]]).pins.map(pin => pin.id)).toEqual(['second'])
  })
})

describe('viewport search scope', () => {
  it('covers the viewport corner instead of only half its width', () => {
    const scope = viewportSearchScope({ latitude: 0, longitude: 106, latitudeDelta: 0.02, longitudeDelta: 0.02 })
    expect(scope).toEqual({ lat: 0, lng: 106, radiusM: 1573 })
  })
  it('uses the farthest corner at high latitude and caps contract limits', () => {
    expect(viewportSearchScope({ latitude: 60, longitude: 179.9, latitudeDelta: 0.2, longitudeDelta: 0.2 })?.radiusM).toBe(12436)
    expect(viewportSearchScope({ latitude: 0, longitude: 0, latitudeDelta: 0.00001, longitudeDelta: 0.00001 })?.radiusM).toBe(100)
    expect(viewportSearchScope({ latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 180 })?.radiusM).toBe(100000)
  })
  it('rejects invalid native region data', () => {
    for (const latitude of [NaN, Infinity, 91]) expect(viewportSearchScope({ latitude, longitude: 0, latitudeDelta: 1, longitudeDelta: 1 })).toBeNull()
    expect(viewportSearchScope({ latitude: 0, longitude: 0, latitudeDelta: 0, longitudeDelta: 1 })).toBeNull()
  })
})

it('carries the category key, never a mood or translated label, into markers', () => {
  expect(discoveryMap(none, [{ ...places[0], taxonomies: [
    { kind: 'mood', key: 'chill' }, { kind: 'category', key: 'cafe' },
  ] }]).pins[0].category).toBe('cafe')
})
