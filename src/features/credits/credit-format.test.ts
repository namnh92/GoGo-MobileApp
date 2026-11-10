import { describe, expect, it } from 'vitest'
import { creditEntries, creditSourceKey, creditsAvailable, formatCredit, type CreditEntry } from './credit-format'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { queryKeys } from '@/shared/api/query-keys'
import type { Me } from '@/shared/api'

const entry = { id: '1', delta: -1, createdAt: '2026-11-10T01:00:00.123456Z', direction: 'spent', source: { type: 'assistant_usage' }, eventKey: 'assistant_usage' } satisfies CreditEntry

describe('credit visibility facts', () => {
  it('requires explicit capability and a registered actor', () => {
    expect(creditsAvailable()).toBe(false)
    expect(creditsAvailable({ actorType: 'user', capabilities: {} } as Me)).toBe(false)
    expect(creditsAvailable({ actorType: 'guest', capabilities: { assistantCredits: true } } as unknown as Me)).toBe(false)
    expect(creditsAvailable({ actorType: 'user', capabilities: { assistantCredits: true } } as Me)).toBe(true)
  })
  it('formats zero, signed debits and locale separators', () => {
    expect(formatCredit(0, 'vi')).toBe('0')
    expect(formatCredit(12345, 'vi')).toBe('12.345')
    expect(formatCredit(12345, 'en')).toBe('12,345')
    expect(formatCredit(-12345, 'en', true)).toBe('-12,345')
    expect(formatCredit(50, 'vi', true)).toBe('+50')
  })
  it('deduplicates pagination and localizes open source keys without showing server copy', () => {
    expect(creditEntries([{ items: [entry] }, { items: [entry, { ...entry, id: '2' }] }])).toHaveLength(2)
    expect(creditSourceKey(entry)).toBe('credits.source.assistant')
    expect(creditSourceKey({ ...entry, source: { type: 'untrusted sentence' } })).toBe('credits.source.event')
    expect(creditSourceKey({ ...entry, direction: 'adjustment' })).toBe('credits.source.adjustment')
  })
  it('never persists credits and separates accounts and lifetimes', () => {
    for (const key of [queryKeys.credits('A', 1), queryKeys.creditSummary('A', 1), queryKeys.creditLedger('A', 1)]) expect(shouldPersistQuery(key)).toBe(false)
    expect(queryKeys.creditSummary('A', 1)).not.toEqual(queryKeys.creditSummary('B', 1))
    expect(queryKeys.creditSummary('A', 1)).not.toEqual(queryKeys.creditSummary('A', 3))
  })
})
