import { useState, type ReactNode } from 'react'
import { Platform, UIManager, View } from 'react-native'

import { isGoogleMapsConfigured } from '../../../modules/map-capability'

import { regionForPins, type MapPin } from '@/shared/ui/map-region'
import { mapColors } from '@/shared/ui/tokens'

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
  style?: object
  /** Shown when no map is available; keeps the surface from reading as broken. */
  fallback?: ReactNode
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

export function MapCanvas({ pins, onSelect, style, fallback }: MapCanvasProps) {
  const maps = loadMaps()
  const region = regionForPins(pins)
  // What the installed binary linked cannot change while it is running, but
  // this component re-renders with its screen — `saved.view` re-renders on
  // every pin tap. Read the binary once per mount, not once per render.
  const [mapsLinked] = useState(googleMapsLinked)

  if (!maps || !region || !mapsLinked) {
    return <View style={[{ backgroundColor: mapColors.canvas }, style]}>{fallback}</View>
  }

  const MapView = maps.default
  const Marker = maps.Marker

  return (
    <MapView
      style={style}
      initialRegion={region}
      provider={maps.PROVIDER_GOOGLE}
      showsUserLocation={false}
      toolbarEnabled={false}
      accessibilityLabel={undefined}
    >
      {pins.map(pin => (
        <Marker
          key={pin.id}
          identifier={pin.id}
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title={pin.title}
          onPress={() => onSelect?.(pin.id)}
          accessibilityLabel={pin.title}
          tracksViewChanges={false}
        >
          {pin.content}
        </Marker>
      ))}
    </MapView>
  )
}
