import { describe, expect, it } from 'vitest'
import { groupCreditEntries, creditEventLabel, creditEntries, creditSourceKey, creditsAvailable, formatCredit, type CreditEntry } from './credit-format'
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

it('groups across a device-local midnight and never merges a conversation across days', () => {
  const before = new Date(2026, 10, 10, 23, 59).toISOString()
  const after = new Date(2026, 10, 11, 0, 1).toISOString()
  const conversation = { id: 'c', title: 'Title' }
  const groups = groupCreditEntries([{ ...entry, id: 'a', createdAt: after, delta: -12, conversation },
    { ...entry, id: 'b', createdAt: after, delta: 4, conversation },
    { ...entry, id: 'c', createdAt: before, delta: -2, conversation }])
  expect(groups.map(group => [group.firstOfDay, group.entries.length, group.total])).toEqual([[true, 2, -8], [true, 1, -2]])
  expect(groups[0].day).not.toBe(groups[1].day)
  expect(creditEventLabel({ ...entry, eventLabels: { vi: 'Thưởng', en: 'Reward' } }, 'en-US')).toBe('Reward')
  expect(creditEventLabel({ ...entry, eventLabels: { vi: '', en: '' } }, 'vi')).toBeUndefined()
})
