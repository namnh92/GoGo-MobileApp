import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type RefAttributes } from 'react'
import { Platform, UIManager, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { googleMapStyle, styles } from './map-canvas.style'
import { Text } from './text'

import { isGoogleMapsConfigured } from '../../../modules/map-capability'

import { regionForPins, type MapPin } from '@/shared/ui/map-region'

/**
 * The one place that knows a map SDK exists (ADR 0004). Everything else takes
 * `MapCanvas` and a list of pins.
 *
 * The module is loaded through a lazy `require` for the same reason
 * `expo-location` is: a native module missing from the running binary throws at
 * import time and would take the whole screen down. Here that degrades to a
 * plain surface, and the caller's list view remains the way to the same places.
 */

export type { MapPin }

export interface MapCanvasProps {
  pins: MapPin[]
  onSelect?: (id: string) => void
  /** Native callout action; selecting a marker can show a separate preview. */
  onOpen?: (id: string) => void
  showsUserLocation?: boolean
  style?: object
  /** Shown when no map is available; keeps the surface from reading as broken. */
  fallback?: ReactNode
  /** Detail previews leave gestures to the surrounding scroll view. */
  interactive?: boolean
  /** Only user gestures trigger viewport exploration. */
  onRegionChangeComplete?: (region: NonNullable<ReturnType<typeof regionForPins>>) => void
  /** Recenter when a discovery scope changes; other maps retain their camera behaviour. */
  cameraRegion?: NonNullable<ReturnType<typeof regionForPins>> | null
  /** Changes only for an intentional recenter, never for viewport exploration. */
  cameraScopeKey?: string
}

interface MapHandle {
  animateToRegion: (region: NonNullable<ReturnType<typeof regionForPins>>, duration: number) => void
}

interface MapsModule {
  default: React.ComponentType<Record<string, unknown> & RefAttributes<MapHandle>>
  Marker: React.ComponentType<Record<string, unknown>>
  Callout: React.ComponentType<Record<string, unknown>>
  PROVIDER_DEFAULT: unknown
  PROVIDER_GOOGLE: unknown
}

function loadMaps(): MapsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-maps') as MapsModule
  } catch {
    return null
  }
}

export function isMapAvailable(): boolean {
  return googleMapsLinked() && loadMaps() !== null
}

/** Probe the installed binary before mounting: a missing Android key throws
 * on a native SDK thread, outside any JS error boundary. Old dev clients lack
 * the capability module and safely show the caller's fallback until rebuilt. */
function googleMapsLinked(): boolean {
  try {
    if (Platform.OS === 'android') {
      return isGoogleMapsConfigured()
    }
    if (Platform.OS !== 'ios') return false
    return UIManager.hasViewManagerConfig('AIRGoogleMap')
  } catch {
    return false
  }
}

/** A provider render failure must preserve the caller's list/directions fallback. */
class MapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function MapCanvas({ pins, onSelect, onOpen, showsUserLocation = false, style, fallback, interactive = true, cameraRegion, cameraScopeKey, onRegionChangeComplete }: MapCanvasProps) {
  const { theme } = useUnistyles()
  const customMapStyle = useMemo(
    () => theme.mode === 'dark' ? googleMapStyle(theme.map) : [],
    [theme.mode, theme.map],
  )
  const maps = loadMaps()
  const region = cameraRegion ?? regionForPins(pins)
  // What the installed binary linked cannot change while it is running, but
  // this component re-renders with its screen — `saved.view` re-renders on
  // every pin tap. Read the binary once per mount, not once per render.
  const [mapsLinked] = useState(googleMapsLinked)

  const mapRef = useRef<MapHandle | null>(null)
  const cameraTarget = cameraRegion ?? (interactive ? null : region)
  const cameraKey = cameraScopeKey ?? JSON.stringify(cameraTarget)
  const appliedCameraKey = useRef(cameraKey)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [providerFailed, setProviderFailed] = useState(false)
  const canMount = !!maps && !!region && mapsLinked
  const hasFallback = fallback != null
  useEffect(() => {
    if (!mapLoaded || !cameraTarget || appliedCameraKey.current === cameraKey) return
    appliedCameraKey.current = cameraKey
    // Keep native gestures in charge between explicit scope/recenter changes.
    // An instant move also respects reduced motion.
    mapRef.current?.animateToRegion(cameraTarget, 0)
  }, [cameraKey, cameraTarget, mapLoaded])
  // Google exposes no tile-error event. A provider that never finishes loading
  // must still yield the list, rather than leave an indefinitely blank map.
  useEffect(() => {
    if (!canMount || !hasFallback || mapLoaded || providerFailed) return
    const timer = setTimeout(() => setProviderFailed(true), 20000)
    return () => clearTimeout(timer)
  }, [canMount, hasFallback, mapLoaded, providerFailed])
  const unavailable = <View style={[styles.fallback, style]}>{fallback}</View>
  if (!maps || !region || !mapsLinked || providerFailed) return unavailable

  const MapView = maps.default
  const Marker = maps.Marker
  const Callout = maps.Callout

  return (
    <MapBoundary fallback={unavailable}>
      <MapView
        ref={mapRef}
        style={[styles.canvas, style]}
        customMapStyle={customMapStyle}
        userInterfaceStyle={theme.mode}
        loadingEnabled
        loadingBackgroundColor={theme.map.canvas}
        loadingIndicatorColor={theme.text.secondary}
        initialRegion={region}
        onRegionChangeComplete={interactive ? (next: NonNullable<ReturnType<typeof regionForPins>>, details: { isGesture?: boolean } = {}) => {
          // Both supported adapters use Google, which reports isGesture. Native
          // camera/layout updates must never launch another search.
          if (details.isGesture !== true) return
          onRegionChangeComplete?.(next)
        } : undefined}
        // AIRGoogleMap inherits UIView, not RCTView. RN 0.81's UIView setter
        // falls through from explicit `auto` to `none`, disabling all touches.
        // Omit it for interactive maps; clearing `none` restores the default.
        pointerEvents={interactive ? undefined : 'none'}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        zoomTapEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        // Android draws +/- zoom buttons by default; a static preview hides
        // them, an interactive map keeps whatever it had before.
        zoomControlEnabled={interactive ? undefined : false}
        provider={maps.PROVIDER_GOOGLE}
        showsUserLocation={showsUserLocation}
        followsUserLocation={false}
        moveOnMarkerPress={false}
        onMapLoaded={() => setMapLoaded(true)}
        toolbarEnabled={false}
        accessibilityLabel={undefined}
      >
        {pins.map(pin => (
          <Marker
            key={pin.id}
            identifier={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            title={pin.title}
            onPress={interactive ? () => onSelect?.(pin.id) : undefined}
            onCalloutPress={interactive && onOpen ? () => onOpen(pin.id) : undefined}
            accessibilityLabel={pin.title}
            tracksViewChanges={false}
          >
            {pin.content}
            <Callout tooltip>
              <View style={styles.callout}>
                <Text variant="bodySmall" color="text.primary">{pin.title}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </MapBoundary>
  )
}
