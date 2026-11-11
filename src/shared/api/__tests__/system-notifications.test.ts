import { afterEach, expect, it, vi } from 'vitest'
import { listSystemNotifications } from '../system-notifications'

afterEach(() => vi.restoreAllMocks())
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const item = { id: '11111111-1111-4111-8111-111111111111', kind: 'maintenance', title: 'Bảo trì', body: 'GoGo bảo trì lúc 23:00.', deepLink: null, publishedAt: '2026-11-09T10:00:00Z', expiresAt: null }

it('validates the public shape, permits future kinds and round-trips the opaque cursor without bearer', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [item, { ...item, kind: 'future' }], nextCursor: null }))
  const result = await listSystemNotifications('opaque+cursor/==')
  expect(result).toEqual({ status: 'supported', items: [item, { ...item, kind: 'future' }], nextCursor: null })
  expect(fetch.mock.calls[0]![0]).toBe('http://localhost:3000/v1/system-notifications?cursor=opaque%2Bcursor%2F%3D%3D&limit=10')
  expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('authorization')
})
it('treats only 404 as unsupported, including an old non-JSON gateway', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))
  expect(await listSystemNotifications()).toEqual({ status: 'unsupported', items: [], nextCursor: null })
})
it.each([403, 500])('preserves HTTP %s as a recoverable error', async status => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ code: 'ERROR', message: 'failed' }, status))
  await expect(listSystemNotifications()).rejects.toMatchObject({ status })
})
it('rejects malformed rows instead of fabricating an empty success', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [{ ...item, publishedAt: 'yesterday' }], nextCursor: null }))
  await expect(listSystemNotifications()).rejects.toHaveProperty('name', 'ZodError')
})
