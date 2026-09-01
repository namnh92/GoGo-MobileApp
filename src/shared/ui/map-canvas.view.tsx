import type { ReactNode } from 'react'
import { Platform, UIManager, View } from 'react-native'

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
  return loadMaps() !== null
}

/**
 * Whether this binary linked Google Maps on iOS (ADR 0005).
 *
 * A fact about the build, not a setting: the `react-native-google-maps` pod is
 * in the binary only if `GOOGLE_MAPS_IOS_API_KEY` was set at prebuild. Asking
 * `react-native-maps` for Google on a binary without it renders the library's
 * "AirGoogleMaps dir must be added" placeholder instead of a map, and the
 * library decides that with this exact probe — so the adapter asks the same
 * question of the same binary. Not a manifest flag: a dev server evaluates the
 * manifest from whatever `.env` it was started with, the binary from the `.env`
 * at prebuild, and the two drift the moment someone edits the key without
 * rebuilding. Android has one provider, Google, and nothing to decide.
 */
function googleMapsLinked(): boolean {
  if (Platform.OS !== 'ios') return false
  try {
    return UIManager.hasViewManagerConfig('AIRGoogleMap')
  } catch {
    return false
  }
}

export function MapCanvas({ pins, onSelect, style, fallback }: MapCanvasProps) {
  const maps = loadMaps()
  const region = regionForPins(pins)

  if (!maps || !region) {
    return <View style={[{ backgroundColor: mapColors.canvas }, style]}>{fallback}</View>
  }

  const MapView = maps.default
  const Marker = maps.Marker

  return (
    <MapView
      style={style}
      initialRegion={region}
      provider={googleMapsLinked() ? maps.PROVIDER_GOOGLE : maps.PROVIDER_DEFAULT}
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
