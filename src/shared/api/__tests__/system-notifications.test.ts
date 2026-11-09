import { expect, it, vi } from 'vitest'
import { useSystemNotificationsQuery } from '../queries/use-system-notifications'

it('reports unsupported without contacting any endpoint until GoGo-BE#815 ships', () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  try {
    expect(useSystemNotificationsQuery()).toEqual({ status: 'unsupported' })
    expect(fetch).not.toHaveBeenCalled()
  } finally { fetch.mockRestore() }
})
