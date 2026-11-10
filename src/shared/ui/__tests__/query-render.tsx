import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { render as nativeRender } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'

// Deliver query observer notifications inside the current async act boundary.
notifyManager.setScheduler(callback => { void Promise.resolve().then(callback) })

/** Screens/cards use the same query context as the app; rerenders retain it. */
export function render(element: ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })) {
  return nativeRender(element, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}
