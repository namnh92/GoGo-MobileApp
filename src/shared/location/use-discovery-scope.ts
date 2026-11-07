import { useAppAreaStore, retryAppArea } from './app-area'
export * from './discovery-scope'

/** Consumers only subscribe; device and server resolution belong to AppAreaProvider. */
export function useDiscoveryScope() {
  const scope = useAppAreaStore(state => state.scope)
  return { scope, retry: retryAppArea }
}
