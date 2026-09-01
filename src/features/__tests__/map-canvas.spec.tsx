import { Text, UIManager, View } from 'react-native'

import { renderScreen } from './harness'

/**
 * The adapter picks one of two paths: a real map when the SDK is loadable, an
 * honest surface when it is not. Both are asserted here, because the fallback
 * is a designed state — Android renders it until a Google Maps API key exists
 * (ADR 0004) — not a console warning.
 *
 * On iOS there is a third decision: which SDK to ask for. Google is a fact
 * about the binary (ADR 0005), read through the same probe `react-native-maps`
 * gates on, so the tests set that probe rather than any config.
 */

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
  binaryLinks()
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

    it('stays on Apple Maps in a binary built without a Google key', async () => {
      // Asking for Google here would render the library's "AirGoogleMaps dir
      // must be added" placeholder, not a map — the binary decides, not config.
      binaryLinks()
      const view = await renderScreen(<MapCanvas pins={PINS} />)
      expect(view.queryAllByTestId('map:default')).toHaveLength(1)
      expect(view.queryAllByTestId('map:google')).toHaveLength(0)
    })
  })
})
