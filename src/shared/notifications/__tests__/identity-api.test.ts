import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import { ApiError } from '@/shared/api/errors'

import { fetchIdentityToken } from '../identity-api'

vi.mock('@/shared/api/client', () => ({ api: { get: vi.fn() } }))

const get = api.get as unknown as ReturnType<typeof vi.fn>

afterEach(() => vi.resetAllMocks())

describe('fetchIdentityToken', () => {
  it('returns the token the server issued', async () => {
    get.mockResolvedValue({ externalId: 'u1', token: 'jwt', expiresAt: '2026-01-01T00:00:00Z' })
    await expect(fetchIdentityToken()).resolves.toEqual({
      kind: 'ok',
      token: { externalId: 'u1', token: 'jwt', expiresAt: '2026-01-01T00:00:00Z' },
    })
    expect(get).toHaveBeenCalledWith('/notifications/identity')
  })

  it('tells "no signing key here" apart from "try again"', async () => {
    // The distinction is the whole point: 503 PUSH_IDENTITY_UNAVAILABLE does not
    // come back on its own, and the server says so with retryable: false.
    get.mockRejectedValue(
      new ApiError(503, { code: 'PUSH_IDENTITY_UNAVAILABLE', message: 'no key', retryable: false }),
    )
    await expect(fetchIdentityToken()).resolves.toEqual({ kind: 'unavailable' })
  })

  it('treats a guest, an expired session and a network fault as retryable', async () => {
    for (const failure of [
      new ApiError(403, { code: 'USER_ONLY', message: 'guests have no identity' }),
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'expired' }),
      new TypeError('Network request failed'),
    ]) {
      get.mockRejectedValueOnce(failure)
      await expect(fetchIdentityToken()).resolves.toEqual({ kind: 'error' })
    }
  })
})
