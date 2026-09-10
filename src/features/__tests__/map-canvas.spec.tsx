import { Platform, Text, UIManager, View } from 'react-native'

import { renderScreen } from './harness'

/** Regression coverage for SDK absence, native key gating and Google provider selection. */

const mockNativeMap = { googleMapsConfigured: false }
jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: () => mockNativeMap,
}))

const mockMapMissing = { value: false }

jest.mock('react-native-maps', () => {
  if (mockMapMissing.value) throw new Error("Cannot find native module 'AIRMap'")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native')
  // Surfaces the provider the adapter asked for; the real values are
  // `PROVIDER_DEFAULT = undefined` and `PROVIDER_GOOGLE = 'google'`.
  const MapView = ({ provider, children, ...rest }: Record<string, unknown>) =>
    React.createElement(RNView, { ...rest, testID: `map:${String(provider ?? 'default')}` }, children)
  return {
    __esModule: true,
    default: MapView,
    Marker: RNView,
    PROVIDER_DEFAULT: undefined,
    PROVIDER_GOOGLE: 'google',
  }
})

import { MapCanvas } from '@/shared/ui/map-canvas.view'

const PINS = [
  { id: 'a', lat: 10.8, lng: 106.7, title: 'Quán A' },
  { id: 'b', lat: 10.79, lng: 106.72, title: 'Quán B' },
]

/**
 * What the binary reports having linked. Set *after* `resetModules`: the
 * adapter reads `UIManager` through react-native's lazy getter at render time,
 * which hands out a fresh mock instance once the registry is reset, so a
 * reference captured at import would be talking to the wrong object.
 */
function binaryLinks(...viewManagers: string[]) {
  ;(UIManager.hasViewManagerConfig as jest.Mock).mockImplementation((name: string) =>
    viewManagers.includes(name),
  )
}

beforeEach(() => {
  mockMapMissing.value = false
  jest.resetModules()
  binaryLinks('AIRGoogleMap')
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
})

describe('MapCanvas', () => {
  it('renders a marker per pin when the SDK is there', async () => {
    const view = await renderScreen(<MapCanvas pins={PINS} />)
    expect(view.queryAllByLabelText('Quán A')).toHaveLength(1)
    expect(view.queryAllByLabelText('Quán B')).toHaveLength(1)
  })

  it('shows the caller fallback when there are no pins to place', async () => {
    const view = await renderScreen(
      <MapCanvas pins={[]} fallback={<Text>Chưa có địa điểm</Text>} />,
    )
    expect(view.queryAllByText('Chưa có địa điểm')).toHaveLength(1)
  })

  it('shows the caller fallback when the SDK is missing, rather than crashing', async () => {
    mockMapMissing.value = true
    const view = await renderScreen(
      <MapCanvas
        pins={PINS}
        fallback={
          <View>
            <Text>Chưa mở được bản đồ</Text>
          </View>
        }
      />,
    )
    expect(view.queryAllByText('Chưa mở được bản đồ')).toHaveLength(1)
    expect(view.queryAllByLabelText('Quán A')).toHaveLength(0)
  })

  describe('iOS provider (ADR 0005)', () => {
    it('asks for Google Maps when the binary linked it', async () => {
      binaryLinks('AIRGoogleMap')
      const view = await renderScreen(<MapCanvas pins={PINS} />)
      expect(view.queryAllByTestId('map:google')).toHaveLength(1)
      expect(view.queryAllByLabelText('Quán A')).toHaveLength(1)
    })

    it('shows fallback in an iOS binary without Google Maps', async () => {
      // A stale binary uses the caller fallback until Google Maps is linked.
      binaryLinks()
      const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>Map unavailable</Text>} />)
      expect(view.queryAllByText('Map unavailable')).toHaveLength(1)
      expect(view.queryAllByTestId('map:default')).toHaveLength(0)
      expect(view.queryAllByTestId('map:google')).toHaveLength(0)
    })
  })
})

describe('Android native configuration', () => {
  it.each([false, true])('only mounts Google Maps with a native key: %s', async configured => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    mockNativeMap.googleMapsConfigured = configured
    const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>Map unavailable</Text>} />)
    expect(view.queryAllByTestId('map:google')).toHaveLength(configured ? 1 : 0)
    expect(view.queryAllByText('Map unavailable')).toHaveLength(configured ? 0 : 1)
  })
})
