import { afterEach, describe, expect, it, vi } from 'vitest'

import { request } from '../client'
import { ApiError, NetworkError, TimeoutError, isRetryable } from '../errors'
import { clearSession, isAccessTokenExpired, sessionFromGrant, type Session } from '../session'

const BASE = 'http://localhost:3000/v1'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Resolves with whatever the promise rejected with, keeping the type honest. */
async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    throw new Error('expected the call to reject')
  } catch (error) {
    return error
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await clearSession()
})

describe('request', () => {
  it('substitutes path params and encodes them', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }))

    await request({
      method: 'GET',
      path: '/rooms/{id}/members',
      pathParams: { id: 'a b/c' },
      anonymous: true,
    })

    expect(fetchSpy.mock.calls[0][0]).toBe(`${BASE}/rooms/a%20b%2Fc/members`)
  })

  it('throws on a missing path param instead of calling the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(
      request({ method: 'GET', path: '/rooms/{id}', pathParams: {}, anonymous: true }),
    ).rejects.toThrow('Missing path param "id"')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('drops empty query values and repeats array values', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }))

    await request({
      method: 'GET',
      path: '/places/search',
      query: { q: 'cà phê', limit: 20, cursor: undefined, minRating: 0, tags: ['a', 'b'] },
      anonymous: true,
    })

    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('q=c%C3%A0%20ph%C3%AA')
    expect(url).toContain('limit=20')
    expect(url).not.toContain('cursor')
    expect(url).toContain('minRating=0')
    expect(url).toContain('tags=a&tags=b')
  })

  it('maps an error envelope onto ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          code: 'ROOM_NOT_MATCHING',
          message: 'Room is not ready for suggestions',
          field_errors: [{ field: 'status', code: 'INVALID', message: 'bad state' }],
          request_id: 'req-123',
          retryable: false,
        },
        409,
      ),
    )

    const error = await catchError(request({ method: 'GET', path: '/rooms/x', anonymous: true }))

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(409)
    expect(apiError.code).toBe('ROOM_NOT_MATCHING')
    expect(apiError.requestId).toBe('req-123')
    expect(apiError.fieldErrorMap()).toEqual({ status: 'bad state' })
  })

  it('falls back to the status when the body is not an error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>gateway error</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    )

    const error = await catchError(request({ method: 'GET', path: '/health', anonymous: true }))

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('HTTP_502')
  })

  it('reports an unreachable network as NetworkError, not a failed response', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'))

    const error = await catchError(request({ method: 'GET', path: '/health', anonymous: true }))

    expect(error).toBeInstanceOf(NetworkError)
  })

  it('aborts once the request budget elapses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )

    const error = await catchError(
      request({ method: 'GET', path: '/health', anonymous: true, timeoutMs: 20 }),
    )

    expect(error).toBeInstanceOf(TimeoutError)
  })

  it('sends the idempotency key header when given one', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }))

    await request({
      method: 'POST',
      path: '/rooms',
      body: { type: 'couple' },
      idempotencyKey: 'key-12345678',
      anonymous: true,
    })

    const headers = (fetchSpy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>
    expect(headers['idempotency-key']).toBe('key-12345678')
  })

  it('returns undefined for a 204 rather than failing to parse an empty body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(
      request({ method: 'DELETE', path: '/me/saved/place/x', anonymous: true }),
    ).resolves.toBeUndefined()
  })
})

describe('session', () => {
  it('treats a guest renewal without expiresIn as a guest session', () => {
    const previous: Session = {
      kind: 'guest',
      accessToken: 'old',
      expiresAt: Date.now(),
      guestToken: 'guest-token',
      roomId: 'room-1',
      guestSessionId: 'gs-1',
    }

    // The server omits `expiresIn` on guest renewal even though the contract
    // marks it required.
    const session = sessionFromGrant(
      { accessToken: 'new', roomId: 'room-1' } as never,
      previous,
    )

    expect(session.kind).toBe('guest')
    expect(session.guestToken).toBe('guest-token')
    expect(session.refreshToken).toBeUndefined()
    expect(session.expiresAt).toBeGreaterThan(Date.now())
  })

  it('keeps a rotated refresh token on a user grant', () => {
    const session = sessionFromGrant({
      accessToken: 'a',
      refreshToken: 'r2',
      expiresIn: 900,
      userId: 'u1',
    })

    expect(session.kind).toBe('user')
    expect(session.refreshToken).toBe('r2')
    expect(session.userId).toBe('u1')
  })

  it('treats a token inside the renewal skew as already expired', () => {
    const session: Session = { kind: 'user', accessToken: 'a', expiresAt: Date.now() + 5_000 }
    expect(isAccessTokenExpired(session)).toBe(true)
  })
})

describe('isRetryable', () => {
  it('retries transport failures and server errors, not client mistakes', () => {
    expect(isRetryable(new NetworkError())).toBe(true)
    expect(isRetryable(new TimeoutError(1000))).toBe(true)
    expect(isRetryable(new ApiError(503, { code: 'X', message: 'x' }))).toBe(true)
    expect(isRetryable(new ApiError(429, { code: 'RATE_LIMITED', message: 'x' }))).toBe(true)
    expect(isRetryable(new ApiError(400, { code: 'BAD', message: 'x' }))).toBe(false)
    expect(isRetryable(new ApiError(403, { code: 'HOST_ONLY', message: 'x' }))).toBe(false)
    expect(isRetryable(new ApiError(409, { code: 'CONFLICT', message: 'x' }))).toBe(false)
  })
})
