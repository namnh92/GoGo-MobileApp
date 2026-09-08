import { describe, expect, it, vi, beforeEach } from 'vitest'

import { api } from '../client'
import { logout } from '../endpoints/sessions'
import { clearSession } from '../session'

// Hoisted by Vitest above the imports above, which is why they can stay in
// conventional order.
vi.mock('../client', () => ({ api: { delete: vi.fn() } }))
vi.mock('../session', () => ({
  clearSession: vi.fn(async () => {}),
  getSession: vi.fn(() => null),
  setSession: vi.fn(),
  subscribeToSession: vi.fn(() => () => {}),
  setOnSessionExpired: vi.fn(),
  hydrateSession: vi.fn(async () => {}),
}))

/**
 * NTF-APP-004 (#160). The wipe used to sit in a `finally`, so a logout the
 * server rejected still cleared the device — leaving a session the server
 * considers live, and destroying the credential the push-unsubscribe check
 * needs.
 */
describe('logout clears credentials only when the server agrees (#160)', () => {
  beforeEach(() => {
    vi.mocked(clearSession).mockClear()
    vi.mocked(api.delete).mockReset()
  })

  it('revokes server-side first, then clears', async () => {
    const order: string[] = []
    vi.mocked(api.delete).mockImplementation(async () => {
      order.push('revoke')
      return undefined as never
    })
    vi.mocked(clearSession).mockImplementation(async () => {
      order.push('clear')
    })

    await logout()

    expect(order).toEqual(['revoke', 'clear'])
  })

  it('does not clear when the server call fails', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('network down'))

    await expect(logout()).rejects.toThrow('network down')
    expect(clearSession).not.toHaveBeenCalled()
  })
})
