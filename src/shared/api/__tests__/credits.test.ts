import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { getMyCredits, getMyCreditLedger } from '../endpoints/credits'
import { clearSession, persistSession, getSessionGeneration } from '../session'
import { bindSessionCaches } from '../session-query-cache'
import { queryKeys } from '../query-keys'
import { shouldPersistQuery } from '../persist-policy'
import { request } from '../client'
import { ApiError } from '../errors'
import { firstPageRefetch } from '../queries/first-page-refetch'

const facts = { balance: 49, earned: 50, spent: 1, reserved: 0, availableBalance: 49, asOf: '2026-11-10T01:00:00Z', policyKey: 'legacy_allowance_v1' }
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
const login = (userId: string) => persistSession({ kind: 'user', userId, accessToken: userId, expiresAt: Date.now() + 600000 })
afterEach(async () => { vi.restoreAllMocks(); await clearSession() })

it('reads self-only facts and sends the opaque cursor unchanged with fixed page ten', async () => {
  await login('A')
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(facts)).mockResolvedValueOnce(json({ items: [], nextCursor: null }))
  expect(await getMyCredits()).toEqual(facts)
  await getMyCreditLedger('opaque:123456/+')
  const url = new URL(String(fetch.mock.calls[1][0]))
  expect(url.pathname).toBe('/v1/me/credits/ledger')
  expect([...url.searchParams.keys()].sort()).toEqual(['cursor', 'limit'])
  expect(url.searchParams.get('limit')).toBe('10')
  expect(url.searchParams.get('cursor')).toBe('opaque:123456/+')
})
it('refresh cancels load-more and drops all later cursors before the first page request', async () => {
  const client = new QueryClient()
  const key = queryKeys.creditLedger('A', 1)
  client.setQueryData(key, { pages: [{ items: ['first'] }, { items: ['old'] }], pageParams: [undefined, 'old-cursor'] })
  const refetch = vi.fn(async () => {
    expect(client.getQueryData(key)).toEqual({ pages: [{ items: ['first'] }], pageParams: [undefined] })
  })
  await firstPageRefetch(client, key, refetch)()
  expect(refetch).toHaveBeenCalledOnce()
  client.clear()
})
it('late financial responses cannot cross A → B → A or repopulate a removed private query', async () => {
  await login('A')
  const generation = getSessionGeneration()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  bindSessionCaches(client)
  let release!: (response: Response) => void
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve }))
  const key = queryKeys.creditSummary('A', generation)
  const request = client.fetchQuery({ queryKey: key, queryFn: ({ signal }) => getMyCredits(signal) }).catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  await clearSession(); await login('B'); await clearSession(); await login('A')
  release(json(facts)); await request
  expect(client.getQueryData(key)).toBeUndefined()
  expect(client.getQueryData(queryKeys.creditSummary('A', getSessionGeneration()))).toBeUndefined()
  expect(getSessionGeneration()).not.toBe(generation)
  client.clear()
})

it('preserves only typed insufficient-credit details across the HTTP parser', async () => {
  const details = { creditBalance: 8, creditReserved: 5, creditAvailable: 3, requiredCredits: 12, remainingToday: 0 as const, resetsAt: '2026-11-11T17:00:00Z' }
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
    code: 'ASSISTANT_INSUFFICIENT_CREDIT', message: 'insufficient', retryable: false,
    details: { ...details, providerSecret: 'must-not-pass' },
  }), { status: 409, headers: { 'content-type': 'application/json' } }))
  const error = await request({ method: 'POST', path: '/assistant/conversations/c/messages', anonymous: true }).catch(error => error)
  expect(error).toBeInstanceOf(ApiError)
  if (!(error instanceof ApiError)) throw new Error('Expected typed API error')
  expect(error.details).toEqual(details)
  expect(error.retryable).toBe(false)
  expect(new ApiError(409, { code: 'ASSISTANT_INSUFFICIENT_CREDIT', message: '', details: { ...details, requiredCredits: 0 } }).details).toBeUndefined()
  expect(new ApiError(500, { code: 'OTHER', message: '', details }).details).toBeUndefined()
})
it('never persists wallet, ledger, conversation accounting or allowance snapshots', () => {
  for (const key of [queryKeys.creditSummary('A', 1), queryKeys.creditLedger('A', 1),
    queryKeys.assistantStatus(), queryKeys.assistantConversation('c'), queryKeys.assistantMessages('c')]) {
    expect(shouldPersistQuery(key)).toBe(false)
  }
})
