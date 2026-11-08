import { act, fireEvent } from '@testing-library/react-native'
import { Platform, StyleSheet, Text, UIManager, View } from 'react-native'
import * as Unistyles from 'react-native-unistyles'

import { renderScreen } from './harness'

/** Regression coverage for SDK absence, native key gating and Google provider selection. */

const mockNativeMap = {
  configured: false,
  isGoogleMapsConfigured: jest.fn((): boolean => mockNativeMap.configured),
}
jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: () => mockNativeMap,
}))

const mockMapMissing = { value: false }
const mockMapRenderFailure = { value: false }
const mockAnimateToRegion = jest.fn()
const mockMapMount = jest.fn()

jest.mock('react-native-maps', () => {
  if (mockMapMissing.value) throw new Error("Cannot find native module 'AIRMap'")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require('react-native')
  // Surfaces the provider the adapter asked for; the real values are
  // `PROVIDER_DEFAULT = undefined` and `PROVIDER_GOOGLE = 'google'`.
  class MapView extends React.Component {
    animateToRegion = mockAnimateToRegion
    componentDidMount() { mockMapMount() }
    render() {
      const { provider, children, ...rest } = this.props
      if (mockMapRenderFailure.value) throw new Error('Provider failed to render')
      return React.createElement(RNView, { ...rest, testID: `map:${String(provider ?? 'default')}` }, children)
    }
  }
  return {
    __esModule: true,
    default: MapView,
    Marker: RNView,
    Callout: RNView,
    PROVIDER_DEFAULT: undefined,
    PROVIDER_GOOGLE: 'google',
  }
})

import { MapCanvas } from '@/shared/ui/map-canvas.view'
import { themes } from '@/shared/ui/theme'
import { darkMapColors } from '@/shared/ui/tokens'

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
  mockAnimateToRegion.mockClear()
  mockMapMount.mockClear()
  mockMapMissing.value = false
  mockMapRenderFailure.value = false
  mockNativeMap.isGoogleMapsConfigured.mockClear()
  jest.resetModules()
  binaryLinks('AIRGoogleMap')
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
})

describe('MapCanvas', () => {
  // The Unistyles Jest mock resolves styles once at module load. Load a fresh
  // stylesheet in each mode to check the same tokens native Unistyles updates.
  it.each(['light', 'dark'] as const)('uses %s tokens for canvas, fallback and callout surfaces', mode => {
    const theme = mode === 'dark' ? themes.orangeDark : themes.orange
    const { StyleSheet: sheet } = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
    sheet.configure({ themes: { orange: theme } as typeof themes })
    try {
      const { styles } = jest.requireActual<typeof import('@/shared/ui/map-canvas.style')>('@/shared/ui/map-canvas.style')
      expect(styles.canvas.backgroundColor).toBe(theme.map.canvas)
      expect(styles.fallback.backgroundColor).toBe(theme.map.canvas)
      expect(styles.callout.backgroundColor).toBe(theme.surface.card)
      expect(styles.callout.borderColor).toBe(theme.border.hairline)
    } finally { sheet.configure({ themes }) }
  })

  it.each(['light', 'dark'] as const)('uses the %s app theme for native map rendering', async mode => {
    const theme = mode === 'dark' ? themes.orangeDark : themes.orange
    Unistyles.StyleSheet.configure({ themes: { orange: theme } as typeof themes })
    try {
      const view = await renderScreen(<MapCanvas pins={PINS} />)
      const map = view.getByTestId('map:google')
      expect(map.props.userInterfaceStyle).toBe(mode)
      expect(map.props.loadingBackgroundColor).toBe(theme.map.canvas)
      expect(map.props.loadingIndicatorColor).toBe(theme.text.secondary)
      if (mode === 'dark') {
        expect(map.props.customMapStyle).toEqual(expect.arrayContaining([
          { elementType: 'geometry', stylers: [{ color: darkMapColors.canvas }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: darkMapColors.water }] },
        ]))
      } else {
        expect(map.props.customMapStyle).toContainEqual({ elementType: 'geometry', stylers: [{ color: theme.map.canvas }] })
      }
    } finally { Unistyles.StyleSheet.configure({ themes }) }
  })

  it('updates the map style when the app scheme changes without remounting the map', async () => {
    Unistyles.StyleSheet.configure({ themes: { orange: themes.orange } as typeof themes })
    try {
      const view = await renderScreen(<MapCanvas pins={PINS} />)
      await fireEvent(view.getByTestId('map:google'), 'mapLoaded')
      Unistyles.StyleSheet.configure({ themes: { orangeDark: themes.orangeDark } as typeof themes })
      await view.rerender(<MapCanvas pins={PINS} />)
      expect(view.getByTestId('map:google').props.customMapStyle).not.toEqual([])
      expect(view.getByTestId('map:google').props.userInterfaceStyle).toBe('dark')
      Unistyles.StyleSheet.configure({ themes: { orange: themes.orange } as typeof themes })
      await view.rerender(<MapCanvas pins={PINS} />)
      expect(view.getByTestId('map:google').props.customMapStyle).toContainEqual({ elementType: 'geometry', stylers: [{ color: themes.orange.map.canvas }] })
      expect(view.getByTestId('map:google').props.userInterfaceStyle).toBe('light')
      expect(mockMapMount).toHaveBeenCalledTimes(1)
      expect(mockAnimateToRegion).not.toHaveBeenCalled()
    } finally { Unistyles.StyleSheet.configure({ themes }) }
  })

  it.each(['ios', 'android'])('leaves detail-preview gestures to the parent on %s', async os => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
    mockNativeMap.configured = true
    const view = await renderScreen(<MapCanvas pins={PINS} interactive={false} />)
    const map = view.getByTestId('map:google')
    expect(map.props.pointerEvents).toBe('none')
    for (const gesture of ['scrollEnabled', 'zoomEnabled', 'zoomTapEnabled', 'rotateEnabled', 'pitchEnabled', 'zoomControlEnabled']) {
      expect(map.props[gesture]).toBe(false)
    }
    expect(map.props.initialRegion).toBeDefined()
    expect(map.props.region).toBeUndefined()
    expect(view.getByLabelText('Quán A').props.onPress).toBeUndefined()
  })

  it('keeps discovery maps interactive by default', async () => {
    const view = await renderScreen(<MapCanvas pins={PINS} />)
    expect(view.getByTestId('map:google').props.scrollEnabled).toBe(true)
    expect(view.getByTestId('map:google').props.zoomEnabled).toBe(true)
    // AIRGoogleMap is a UIView: RN 0.81's explicit auto setter falls
    // through to none. Leave native hit testing at its enabled default.
    expect(view.getByTestId('map:google').props.pointerEvents).toBeUndefined()
    expect(view.getByTestId('map:google').props.zoomControlEnabled).toBeUndefined()
  })

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
    mockNativeMap.configured = configured
    const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>Map unavailable</Text>} />)
    expect(view.queryAllByTestId('map:google')).toHaveLength(configured ? 1 : 0)
    expect(view.queryAllByText('Map unavailable')).toHaveLength(configured ? 0 : 1)
  })

  // The manifest key cannot change inside a running process, but `MapCanvas`
  // re-renders whenever its screen does — `saved.view` re-renders on every pin
  // tap. Reading the binary is a per-mount fact, not a per-render one.
  it('reads the native capability once per mount, not on every render', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    mockNativeMap.configured = true
    const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>Map unavailable</Text>} />)
    expect(mockNativeMap.isGoogleMapsConfigured).toHaveBeenCalledTimes(1)

    await view.rerender(<MapCanvas pins={PINS} fallback={<Text>Map unavailable</Text>} />)
    expect(mockNativeMap.isGoogleMapsConfigured).toHaveBeenCalledTimes(1)
  })
})


it('updates the native camera imperatively independently of the loaded discovery markers', async () => {
  const region = { latitude: PINS[0].lat, longitude: PINS[0].lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
  const view = await renderScreen(<MapCanvas pins={PINS} cameraRegion={region} showsUserLocation />)
  expect(view.getByTestId('map:google').props.initialRegion).toEqual(region)
  expect(view.getByTestId('map:google').props.region).toBeUndefined()
  await fireEvent(view.getByTestId('map:google'), 'mapLoaded')
  expect(view.getAllByLabelText('Quán A')).toHaveLength(1)
  expect(view.getAllByLabelText('Quán B')).toHaveLength(1)
  expect(view.getByTestId('map:google').props.showsUserLocation).toBe(true)
  expect(view.getByTestId('map:google').props.moveOnMarkerPress).toBe(false)
  const next = { ...region, latitude: PINS[1].lat, longitude: PINS[1].lng }
  await view.rerender(<MapCanvas pins={[PINS[1]]} cameraRegion={next} />)
  expect(mockAnimateToRegion).toHaveBeenCalledWith(next, 0)
  expect(view.getByTestId('map:google').props.region).toBeUndefined()
  expect(view.queryByLabelText('Quán A')).toBeNull()
  expect(view.getAllByLabelText('Quán B')).toHaveLength(1)
})


it('selects a named marker and opens its detail through the native callout', async () => {
  const select = jest.fn()
  const open = jest.fn()
  const view = await renderScreen(<MapCanvas pins={PINS} onSelect={select} onOpen={open} />)
  const marker = view.getByLabelText('Quán B')
  expect(marker.props.title).toBe('Quán B')
  await fireEvent.press(marker)
  expect(select).toHaveBeenCalledWith('b')
  await fireEvent(marker, 'calloutPress')
  expect(open).toHaveBeenCalledWith('b')
})

it('falls back when a linked provider never loads tiles', async () => {
  jest.useFakeTimers()
  try {
    const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>List and directions</Text>} />)
    expect(view.getByTestId('map:google')).toBeTruthy()
    await act(async () => { await jest.advanceTimersByTimeAsync(20000) })
    expect(view.queryByTestId('map:google')).toBeNull()
    expect(view.getByText('List and directions')).toBeTruthy()
  } finally { jest.useRealTimers() }
})

it('keeps a loaded provider after the failure deadline', async () => {
  jest.useFakeTimers()
  try {
    const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>List and directions</Text>} />)
    await fireEvent(view.getByTestId('map:google'), 'mapLoaded')
    await act(async () => { await jest.advanceTimersByTimeAsync(20000) })
    expect(view.getByTestId('map:google')).toBeTruthy()
    expect(view.queryByText('List and directions')).toBeNull()
  } finally { jest.useRealTimers() }
})


it('preserves the fallback when the linked provider throws while rendering', async () => {
  mockMapRenderFailure.value = true
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const view = await renderScreen(<MapCanvas pins={PINS} fallback={<Text>List and directions</Text>} />)
    expect(view.getByText('List and directions')).toBeTruthy()
    expect(view.queryByTestId('map:google')).toBeNull()
  } finally { log.mockRestore() }
})

it('searches only gesture-driven regions and keeps the user camera when markers arrive', async () => {
  const changed = jest.fn()
  const camera = { latitude: 21, longitude: 105, latitudeDelta: 0.01, longitudeDelta: 0.01 }
  const dragged = { ...camera, latitude: 22, longitudeDelta: 0.03 }
  const view = await renderScreen(<MapCanvas pins={PINS} cameraRegion={camera} cameraScopeKey="scope-a" onRegionChangeComplete={changed} />)
  await fireEvent(view.getByTestId('map:google'), 'mapLoaded')
  await fireEvent(view.getByTestId('map:google'), 'regionChangeComplete', dragged, { isGesture: false })
  await fireEvent(view.getByTestId('map:google'), 'regionChangeComplete', dragged)
  expect(changed).not.toHaveBeenCalled()
  await fireEvent(view.getByTestId('map:google'), 'regionChangeComplete', dragged, { isGesture: true })
  expect(changed).toHaveBeenCalledTimes(1)
  expect(changed).toHaveBeenCalledWith(dragged)
  await view.rerender(<MapCanvas pins={[...PINS, { id: 'c', title: 'New', lat: 22, lng: 105 }]} cameraRegion={{ ...dragged }} cameraScopeKey="scope-a" onRegionChangeComplete={changed} />)
  expect(view.getByTestId('map:google').props.region).toBeUndefined()
  expect(mockAnimateToRegion).not.toHaveBeenCalled()
  expect(view.getByTestId('map:google').props.zoomEnabled).toBe(true)
  const nextScope = { ...camera, latitude: 10 }
  await view.rerender(<MapCanvas pins={PINS} cameraRegion={nextScope} cameraScopeKey="scope-b" onRegionChangeComplete={changed} />)
  expect(mockAnimateToRegion).toHaveBeenCalledTimes(1)
  expect(mockAnimateToRegion).toHaveBeenCalledWith(nextScope, 0)
  expect(view.getByTestId('map:google').props.region).toBeUndefined()
})

it('defers intentional camera changes until the provider loads', async () => {
  const camera = { latitude: 21, longitude: 105, latitudeDelta: 0.01, longitudeDelta: 0.01 }
  const next = { ...camera, latitude: 10 }
  const view = await renderScreen(<MapCanvas pins={PINS} cameraRegion={camera} />)
  await view.rerender(<MapCanvas pins={PINS} cameraRegion={next} />)
  expect(mockAnimateToRegion).not.toHaveBeenCalled()
  await fireEvent(view.getByTestId('map:google'), 'mapLoaded')
  expect(mockAnimateToRegion).toHaveBeenCalledTimes(1)
  expect(mockAnimateToRegion).toHaveBeenCalledWith(next, 0)
  await view.rerender(<MapCanvas pins={PINS} cameraRegion={{ ...next }} />)
  expect(mockAnimateToRegion).toHaveBeenCalledTimes(1)
})

it('refits static previews when their pins change without controlling region', async () => {
  const view = await renderScreen(<MapCanvas pins={PINS} interactive={false} />)
  await fireEvent(view.getByTestId('map:google'), 'mapLoaded')
  await view.rerender(<MapCanvas pins={[PINS[1]]} interactive={false} />)
  expect(mockAnimateToRegion).toHaveBeenCalledWith({ latitude: PINS[1].lat, longitude: PINS[1].lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 0)
  expect(view.getByTestId('map:google').props.region).toBeUndefined()
})

it('restores native map gestures after switching from a static preview', async () => {
  const view = await renderScreen(<MapCanvas pins={PINS} interactive={false} />)
  expect(view.getByTestId('map:google').props.pointerEvents).toBe('none')
  await view.rerender(<MapCanvas pins={PINS} />)
  const map = view.getByTestId('map:google')
  expect(map.props.pointerEvents).toBeUndefined()
  expect(map.props.scrollEnabled).toBe(true)
  expect(map.props.zoomEnabled).toBe(true)
  expect(mockMapMount).toHaveBeenCalledTimes(1)
})
describe('category markers', () => {
  it.each([
    ['cafe', '☕'], ['restaurant', '🍜'], ['bar', '🍸'], ['park', '🏞️'],
    ['museum', '🖼️'], ['cinema', '🎬'], ['shopping', '🛍️'], ['lodging', '🛏️'],
  ])('uses the existing chip glyph for %s', async (category, glyph) => {
    const view = await renderScreen(<MapCanvas pins={[{ ...PINS[0], category }]} />)
    expect(view.getByTestId('place-marker-a')).toBeTruthy()
    expect(view.getByText(glyph)).toBeTruthy()
  })

  it.each([undefined, 'new_cms_category', '__proto__', 'romantic'])('uses a generic place icon for %s', async category => {
    const view = await renderScreen(<MapCanvas pins={[{ ...PINS[0], category }]} />)
    expect(view.getByTestId('place-marker-a')).toBeTruthy()
    expect(view.getByTestId('icon-map-pin')).toBeTruthy()
  })

  it.each(['light', 'dark'] as const)('enlarges selection, uses %s tokens and freezes snapshots after visual changes', async mode => {
    jest.useFakeTimers()
    const theme = mode === 'dark' ? themes.orangeDark : themes.orange
    Unistyles.StyleSheet.configure({ themes: { orange: theme } as typeof themes })
    try {
      const pin = { ...PINS[0], category: 'cafe' }
      const view = await renderScreen(<MapCanvas pins={[pin]} />)
      const normal = StyleSheet.flatten(view.getByTestId('place-marker-a').props.style)
      expect(view.getByLabelText(pin.title).props.tracksViewChanges).toBe(true)
      await fireEvent(view.getByTestId('place-marker-a'), 'layout')
      await act(async () => { await jest.advanceTimersByTimeAsync(100) })
      expect(view.getByLabelText(pin.title).props.tracksViewChanges).toBe(false)
      await view.rerender(<MapCanvas pins={[{ ...pin, selected: true }]} />)
      const selected = StyleSheet.flatten(view.getByTestId('place-marker-a').props.style)
      expect(selected.width).toBeGreaterThan(normal.width)
      const bubble = view.getByTestId('place-marker-bubble-a')
      expect(StyleSheet.flatten(bubble.props.style).backgroundColor).toBe(theme.accent.primary)
      expect(view.getByLabelText(pin.title).props.accessibilityState.selected).toBe(true)
      expect(view.getByLabelText(pin.title).props.tracksViewChanges).toBe(true)
      await act(async () => { await jest.advanceTimersByTimeAsync(100) })
      expect(view.getByLabelText(pin.title).props.tracksViewChanges).toBe(false)
      await view.rerender(<MapCanvas pins={[{ ...pin, selected: true }]} />)
      expect(view.getByLabelText(pin.title).props.tracksViewChanges).toBe(false)
      expect(mockMapMount).toHaveBeenCalledTimes(1)
    } finally { jest.useRealTimers(); Unistyles.StyleSheet.configure({ themes }) }
  })
})
