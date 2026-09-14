/**
 * ADM-204 (#209) — a device position Home may use without asking anything.
 *
 * Kept free of React Native imports so vitest can exercise it in plain Node.
 * It never prompts: permission is requested only from an explicit control, and
 * an old or slow fix is "no position", so discovery falls back to the account
 * area instead of ranking by where the user was hours ago.
 */

/** A fix older than this is not where the user is now. */
export const MAX_FIX_AGE_MS = 10 * 60 * 1000
/** How long Home waits for a fresh fix before falling back. */
export const FIX_TIMEOUT_MS = 8_000

export type Position = { lat: number; lng: number }

type Fix = { coords: { latitude: number; longitude: number }; timestamp: number }

/** The subset of `expo-location` this needs, so tests can pass a fake. */
export interface LocationReader {
  getForegroundPermissionsAsync: () => Promise<{ status: string }>
  getLastKnownPositionAsync: (options?: { maxAge?: number }) => Promise<Fix | null>
  getCurrentPositionAsync: (options?: { accuracy?: number }) => Promise<Fix>
  Accuracy: { Balanced: number }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

export async function readFreshPosition(
  Location: LocationReader | null,
  now: () => number = Date.now,
): Promise<Position | null> {
  if (!Location) return null
  try {
    const permission = await Location.getForegroundPermissionsAsync()
    if (permission.status !== 'granted') return null
    const last = await Location.getLastKnownPositionAsync({ maxAge: MAX_FIX_AGE_MS })
    if (last && now() - last.timestamp <= MAX_FIX_AGE_MS) {
      return { lat: last.coords.latitude, lng: last.coords.longitude }
    }
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      FIX_TIMEOUT_MS,
    )
    if (!current || now() - current.timestamp > MAX_FIX_AGE_MS) return null
    return { lat: current.coords.latitude, lng: current.coords.longitude }
  } catch {
    return null
  }
}
