import { areaLabelFrom } from './area-label'
import { readFreshPosition } from './fresh-position'

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

/** Native access is used only by the app-wide controller. Startup never prompts. */
export async function currentPermission(): Promise<string> {
  try { return (await loadLocation()?.getForegroundPermissionsAsync())?.status ?? 'unavailable' }
  catch { return 'unavailable' }
}

export async function readCurrentLocation(explicit: boolean): Promise<LocationState> {
  const Location = loadLocation()
  if (!Location) return { status: 'unavailable' }
  if (!explicit) {
    const position = await readFreshPosition(Location)
    return position ? { status: 'granted', ...position, label: null } : { status: await currentPermission() === 'denied' ? 'denied' : 'unavailable' }
  }
  try {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (permission.status !== 'granted') return { status: 'denied' }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const { latitude: lat, longitude: lng } = position.coords
    let label: string | null = null
    try { label = areaLabelFrom((await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0]) } catch { /* Cosmetic. */ }
    return { status: 'granted', lat, lng, label }
  } catch { return { status: 'unavailable' } }
}

