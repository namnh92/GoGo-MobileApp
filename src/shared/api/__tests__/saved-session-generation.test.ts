import { afterEach, expect, it, vi } from 'vitest'

import { saveItem, unsaveItem } from '../endpoints/me'
import { clearSession, getSession, getSessionGeneration, persistSession, type Session } from '../session'

const accountA: Session = {
  kind: 'user', userId: 'A', accessToken: 'access-A', refreshToken: 'refresh-A', expiresAt: Date.now() + 600_000,
}
const accountB: Session = { ...accountA, userId: 'B', accessToken: 'access-B', refreshToken: 'refresh-B' }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})

afterEach(async () => { vi.restoreAllMocks(); await clearSession() })

it.each([saveItem, unsaveItem])('rejects obsolete saved requests before reading B credentials (%#)', async mutate => {
  await persistSession(accountA)
  const generation = getSessionGeneration()
  await clearSession()
  await persistSession(accountB)
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({}))
  await expect(mutate('place', 'canonical', generation)).rejects.toThrow('Session changed')
  expect(fetch).not.toHaveBeenCalled()
})

it('does not replay A 401 using B refresh token', async () => {
  await persistSession(accountA)
  const generation = getSessionGeneration()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    await clearSession()
    await persistSession(accountB)
    return json({ code: 'UNAUTHORIZED' }, 401)
  })
  await expect(saveItem('place', 'canonical', generation)).rejects.toThrow('Session changed')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({ authorization: 'Bearer access-A' })
})

it.each([200, 401])('preserves B after A credential renewal settles (%s)', async status => {
  await persistSession({ ...accountA, expiresAt: 0 })
  const generation = getSessionGeneration()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    await clearSession()
    await persistSession(accountB)
    return status === 200
      ? json({ userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900 })
      : json({ code: 'SESSION_REVOKED' }, 401)
  })
  await expect(saveItem('place', 'canonical', generation)).rejects.toThrow('Session changed')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(String(fetch.mock.calls[0]![0])).toMatch(/\/auth\/refresh$/)
  expect(getSession()).toEqual(accountB)
})

it('keeps ordinary same-account renewal usable for a saved mutation', async () => {
  await persistSession({ ...accountA, expiresAt: 0 })
  const generation = getSessionGeneration()
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  await expect(saveItem('place', 'canonical', generation)).resolves.toBeUndefined()
  expect(getSessionGeneration()).toBe(generation)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1]![1]?.headers).toMatchObject({ authorization: 'Bearer renewed-A' })
})
