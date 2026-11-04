import { afterEach, describe, expect, it, vi } from 'vitest'

import { request } from '../client'
import { ApiError } from '../errors'
import { clearSession, persistSession, sessionFromGrant } from '../session'

/**
 * GoGo-MobileApp#398: the device routes (ADR-0038) carry the device credential in
 * place of the session, and a 401 on them is a client bug, not an expired session.
 */

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await clearSession()
})

async function signedIn() {
  await persistSession(
    sessionFromGrant({ accessToken: 'session-token', refreshToken: 'refresh-token', expiresIn: 3600, userId: 'user-1' } as never),
  )
}

describe('a request with a device credential', () => {
  it('sends the credential and never the session bearer', async () => {
    await signedIn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(200, {}))
    await request({ method: 'POST', path: '/notifications/identity/device/token', deviceCredential: 'id.secret' })
    const headers = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers.authorization).toBe('Device id.secret')
  })

  it('a 401 does not try to renew the session, and does not end it', async () => {
    await signedIn()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(respond(401, { code: 'DEVICE_CREDENTIAL_REQUIRED', message: 'x' }))
    const failure = await request({
      method: 'POST',
      path: '/notifications/identity/device/token',
      deviceCredential: 'id.secret',
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).code).toBe('DEVICE_CREDENTIAL_REQUIRED')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
