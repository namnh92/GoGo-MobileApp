import { useCallback, useState } from 'react'

import { areaLabelFrom } from './area-label'

/**
 * Location is asked for in context — when the user taps "use my location" —
 * never on launch, and every outcome has to leave them a way forward: the area
 * picker is always there (APP-005).
 *
 * `expo-location` throws "Cannot find native module 'ExpoLocation'" at *import*
 * time on a dev-client binary built before it was added — verified on a
 * simulator, where a static import took the whole create-location screen down.
 * Loading it lazily inside a try/catch turns that into `unavailable`, which
 * falls back to the area picker.
 */

export type LocationState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'granted'; lat: number; lng: number; label: string | null }
  | { status: 'denied' }
  | { status: 'unavailable' }

type LocationModule = typeof import('expo-location')

function loadLocation(): LocationModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as LocationModule
  } catch {
    return null
  }
}

export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' })

  const request = useCallback(async (): Promise<LocationState> => {
    setState({ status: 'asking' })

    const Location = loadLocation()
    if (!Location) {
      const missing: LocationState = { status: 'unavailable' }
      setState(missing)
      return missing
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        const result: LocationState = { status: 'denied' }
        setState(result)
        return result
      }

      // Balanced accuracy: the app ranks places by area, not by metres, and a
      // coarser fix is faster and less invasive.
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude, longitude } = position.coords

      let label: string | null = null
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude })
        label = areaLabelFrom(places[0])
      } catch {
        // A missing label is cosmetic; the coordinates are what matter.
      }

      const result: LocationState = { status: 'granted', lat: latitude, lng: longitude, label }
      setState(result)
      return result
    } catch {
      const result: LocationState = { status: 'unavailable' }
      setState(result)
      return result
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, request, reset }
}
