import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { getNotificationReadOperation, getNotificationSummary, getNotificationSettings, patchNotificationSettings, listNotifications, readAllNotifications } from '../endpoints/me'
import { clearSession, getSessionGeneration, persistSession } from '../session'

beforeEach(async () => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'token-A', expiresAt: Date.now() + 600000 })
})
afterEach(async () => { vi.restoreAllMocks(); await clearSession() })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})

it.each([200, 202])('uses the typed authenticated read APIs for HTTP %s with an unchanged opaque cutoff', async status => {
  const snapshot = { unreadCount: 701, asOf: '2026-11-08T12:00:00Z', readThroughCursor: 'opaque.signed+cutoff/==' }
  const operation = { operationId: 'op-id', status: status === 202 ? 'running' : 'completed', asOf: snapshot.asOf, changedCount: 500 }
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json(snapshot))
    .mockResolvedValueOnce(json(operation, status))
    .mockResolvedValueOnce(json({ ...operation, status: 'completed' }))
  const summary = await getNotificationSummary()
  expect(summary).toEqual(snapshot)
  expect(await readAllNotifications({ through: summary.readThroughCursor }, 'read-intent-123', getSessionGeneration())).toEqual(operation)
  const [url, request] = fetch.mock.calls[1]!
  expect(url).toBe('http://localhost:3000/v1/me/notifications/read-all')
  expect(request?.body).toBe(JSON.stringify({ through: snapshot.readThroughCursor }))
  expect(request?.headers).toMatchObject({ authorization: 'Bearer token-A', 'idempotency-key': 'read-intent-123' })
  expect(await getNotificationReadOperation(operation.operationId, getSessionGeneration())).toMatchObject({ status: 'completed' })
  expect(fetch.mock.calls[2]![0]).toBe('http://localhost:3000/v1/me/notifications/read-all/op-id')
})

it('round-trips opaque list cursors without parsing or truncating the tuple', async () => {
  const cursor = 'opaque.createdAt+id/=='
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ notifications: [], nextCursor: null }))
  await listNotifications({ cursor })
  expect(fetch.mock.calls[0]![0]).toBe(`http://localhost:3000/v1/me/notifications?cursor=${encodeURIComponent(cursor)}`)
})


it('serializes kinds as repeated parameters alongside an opaque cursor', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ notifications: [], nextCursor: null }))
  await listNotifications({ kinds: ['plan_ready', 'plan_changed'], cursor: 'bound+cursor/==' })
  const url = new URL(String(fetch.mock.calls[0]![0]))
  expect(url.searchParams.getAll('kinds')).toEqual(['plan_ready', 'plan_changed'])
  expect(url.searchParams.get('cursor')).toBe('bound+cursor/==')
})


it('uses the BFF strong ETag verbatim for the authenticated category PATCH and retains the new validator', async () => {
  const categories = { invite: false, preference_reminder: true, plan_ready: true, plan_changed: true, date_reminder: false }
  const settings = { pushEnabled: false, source: 'explicit', updatedAt: null, version: '9007199254740993', categories }
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(settings), { headers: { 'content-type': 'application/json', ETag: '"opaque-get-validator"' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...settings, version: '9007199254740994', categories: { ...categories, invite: true } }), { headers: { 'content-type': 'application/json', ETag: '"opaque-patch-validator"' } }))
  const before = await getNotificationSettings()
  expect(before.etag).toBe('"opaque-get-validator"')
  const after = await patchNotificationSettings({ categories: { invite: true } }, before.etag!, 'category-intent-123', getSessionGeneration())
  expect(after).toMatchObject({ pushEnabled: false, version: '9007199254740994', etag: '"opaque-patch-validator"', categories: { ...categories, invite: true } })
  const [url, request] = fetch.mock.calls[1]!
  expect(url).toBe('http://localhost:3000/v1/me/notification-settings')
  expect(request?.method).toBe('PATCH')
  expect(request?.headers).toMatchObject({ authorization: 'Bearer token-A', 'if-match': before.etag, 'idempotency-key': 'category-intent-123' })
  expect(request?.body).toBe(JSON.stringify({ categories: { invite: true } }))
})

it('reads quiet hours and sends a quiet-only PATCH with If-Match and idempotency, retaining the new ETag', async () => {
  const settings = { pushEnabled: false, source: 'default', updatedAt: null, quietHours: { enabled: false, timezone: null } }
  const quietHours = { enabled: true, timezone: 'Asia/Ho_Chi_Minh' }
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(settings), { headers: { 'content-type': 'application/json', ETag: '"quiet-get"' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...settings, quietHours }), { headers: { 'content-type': 'application/json', ETag: '"quiet-patch"' } }))
  const before = await getNotificationSettings()
  expect(before.quietHours).toEqual({ enabled: false, timezone: null })
  const after = await patchNotificationSettings({ quietHours }, before.etag!, 'quiet-intent-123', getSessionGeneration())
  expect(after).toMatchObject({ pushEnabled: false, quietHours, etag: '"quiet-patch"' })
  const [url, request] = fetch.mock.calls[1]!
  expect(url).toBe('http://localhost:3000/v1/me/notification-settings')
  expect(request?.method).toBe('PATCH')
  expect(request?.headers).toMatchObject({ authorization: 'Bearer token-A', 'if-match': '"quiet-get"', 'idempotency-key': 'quiet-intent-123' })
  expect(request?.body).toBe(JSON.stringify({ quietHours }))
})
