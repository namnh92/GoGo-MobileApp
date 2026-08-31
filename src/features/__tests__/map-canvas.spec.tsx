import { Text, View } from 'react-native'

import { renderScreen } from './harness'

/**
 * The adapter picks one of two paths: a real map when the SDK is loadable, an
 * honest surface when it is not. Both are asserted here, because the fallback
 * is a designed state — Android renders it until a Google Maps API key exists
 * (ADR 0004) — not a console warning.
 */

const mockMapMissing = { value: false }

jest.mock('react-native-maps', () => {
  if (mockMapMissing.value) throw new Error("Cannot find native module 'AIRMap'")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native')
  return {
    __esModule: true,
    default: RNView,
    Marker: RNView,
    PROVIDER_DEFAULT: 'default',
  }
})

import { MapCanvas } from '@/shared/ui/map-canvas.view'

const PINS = [
  { id: 'a', lat: 10.8, lng: 106.7, title: 'Quán A' },
  { id: 'b', lat: 10.79, lng: 106.72, title: 'Quán B' },
]

beforeEach(() => {
  mockMapMissing.value = false
  jest.resetModules()
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
})
