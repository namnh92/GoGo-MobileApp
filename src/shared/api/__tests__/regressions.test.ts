import { afterEach, describe, expect, it, vi } from 'vitest'

import { request } from '../client'
import { NetworkError } from '../errors'
import { clearSession, getSession, persistSession, type Session } from '../session'

/**
 * Regressions for bugs found while integrating against a live GoGo-BE
 * (namnh92/GoGo-MobileApp#47). Each one was silent in a way that sent a
 * developer looking in the wrong place, so each keeps a test.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await clearSession()
})

describe('regression: a programming error must not masquerade as a network failure', () => {
  it('throws a missing-path-param error instead of NetworkError', async () => {
    // `buildUrl` used to run inside the fetch try/catch, so forgetting a path
    // param surfaced as NETWORK_UNREACHABLE and sent people to debug wifi.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const error = await request({
      method: 'GET',
      path: '/plans/{id}/stops/{stopId}/lock',
      pathParams: { id: 'plan-1' },
      anonymous: true,
    }).catch((caught: unknown) => caught)

    expect(error).not.toBeInstanceOf(NetworkError)
    expect((error as Error).message).toContain('Missing path param "stopId"')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('still reports a genuine transport failure as NetworkError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'))

    const error = await request({ method: 'GET', path: '/health', anonymous: true }).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(NetworkError)
  })
})

describe('regression: rotating refresh tokens must rotate exactly once', () => {
  const expiredSession: Session = {
    kind: 'user',
    accessToken: 'expired-access',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() - 1_000,
    userId: 'user-1',
  }

  it('serialises concurrent expired calls behind a single refresh', async () => {
    await persistSession(expiredSession)

    let refreshCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1
        // A single-use token replayed in parallel revokes the whole session
        // family, so the second presentation must never happen.
        const body = JSON.parse(String(init?.body ?? '{}')) as { refreshToken?: string }
        if (body.refreshToken !== 'refresh-1') {
          return jsonResponse({ code: 'INVALID_TOKEN', message: 'superseded' }, 401)
        }
        return jsonResponse(
          { accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900, userId: 'user-1' },
          201,
        )
      }

      const authorization = (init?.headers as Record<string, string> | undefined)?.authorization
      if (authorization !== 'Bearer access-2') {
        return jsonResponse({ code: 'INVALID_TOKEN', message: 'stale' }, 401)
      }
      return jsonResponse({ actorType: 'user', id: 'user-1' })
    })

    const results = await Promise.all([
      request<{ actorType: string }>({ method: 'GET', path: '/me' }),
      request<{ actorType: string }>({ method: 'GET', path: '/me' }),
      request<{ actorType: string }>({ method: 'GET', path: '/me' }),
    ])

    expect(refreshCalls).toBe(1)
    expect(results.every(result => result.actorType === 'user')).toBe(true)

    const session = getSession() as Session
    expect(session.accessToken).toBe('access-2')
    expect(session.refreshToken).toBe('refresh-2')
  })

  it('signs out when the refresh token is rejected', async () => {
    await persistSession(expiredSession)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 'SESSION_REVOKED', message: 'revoked' }, 401),
    )

    await expect(request({ method: 'GET', path: '/me' })).rejects.toThrow()
    expect(getSession()).toBeNull()
  })

  it('keeps the session when refresh fails on the network', async () => {
    await persistSession(expiredSession)

    // A tunnel must not log the user out: the refresh token is still valid.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'))

    await expect(request({ method: 'GET', path: '/me' })).rejects.toThrow()
    expect(getSession()?.refreshToken).toBe('refresh-1')
  })
})

describe('regression: a guest renewal without expiresIn stays a usable session', () => {
  it('renews from the guestToken and keeps the room scope', async () => {
    await persistSession({
      kind: 'guest',
      accessToken: 'expired-guest',
      guestToken: 'guest-token-1',
      roomId: 'room-1',
      guestSessionId: 'gs-1',
      expiresAt: Date.now() - 1_000,
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      // The server omits `expiresIn` here even though the contract marks it
      // required; computing an expiry from undefined would wedge the session.
      if (String(input).endsWith('/auth/refresh')) {
        return jsonResponse({ accessToken: 'guest-access-2', roomId: 'room-1' }, 201)
      }
      return jsonResponse({ actorType: 'guest', id: 'gs-1', roomId: 'room-1' })
    })

    await request({ method: 'GET', path: '/me' })

    const session = getSession() as Session
    expect(session.kind).toBe('guest')
    expect(session.guestToken).toBe('guest-token-1')
    expect(session.roomId).toBe('room-1')
    expect(session.expiresAt).toBeGreaterThan(Date.now())
  })
})
