import { Component, useEffect, useState, type ReactNode } from 'react'
import { Platform, UIManager, View } from 'react-native'
import { styles } from './map-canvas.style'

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
  /** Recenter when a discovery scope changes; other maps retain their camera behaviour. */
  cameraRegion?: NonNullable<ReturnType<typeof regionForPins>> | null
}

interface MapsModule {
  default: React.ComponentType<Record<string, unknown>>
  Marker: React.ComponentType<Record<string, unknown>>
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

export function MapCanvas({ pins, onSelect, onOpen, showsUserLocation = false, style, fallback, interactive = true, cameraRegion }: MapCanvasProps) {
  const maps = loadMaps()
  const region = cameraRegion ?? regionForPins(pins)
  // What the installed binary linked cannot change while it is running, but
  // this component re-renders with its screen — `saved.view` re-renders on
  // every pin tap. Read the binary once per mount, not once per render.
  const [mapsLinked] = useState(googleMapsLinked)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [providerFailed, setProviderFailed] = useState(false)
  const canMount = !!maps && !!region && mapsLinked
  const hasFallback = fallback != null
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

  return (
    <MapBoundary fallback={unavailable}>
      <MapView
        style={style}
        initialRegion={region}
        // Controlled region updates move the native camera without animation on
        // both Google adapters, including while reduced motion is enabled.
        region={cameraRegion ?? (interactive ? undefined : region)}
        pointerEvents={interactive ? 'auto' : 'none'}
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
          </Marker>
        ))}
      </MapView>
    </MapBoundary>
  )
}
