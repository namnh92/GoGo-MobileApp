import { useCallback } from 'react'
import { appArea, useAppAreaStore } from './app-area'
export type { LocationState } from './native-location'

/** Every explicit location control resolves the same app-wide area. */
export function useCurrentLocation() {
  const state = useAppAreaStore(state => state.location)
  const request = useCallback(() => appArea.request(), [])
  const refresh = useCallback(() => appArea.refresh(), [])
  const reset = useCallback(() => useAppAreaStore.setState({ location: { status: 'idle' } }), [])
  return { state, request, refresh, reset }
}
