import { describe, expect, it } from 'vitest'

import type { AssistantConversation } from '@/shared/api/types'

import { groupConversations, historyGroupOf } from '../history-groups'

/**
 * GoGo-MobileApp#378 — "Today" / "Yesterday" / "Earlier" come from
 * `lastMessageAt` in the device's time zone; the server sends no label.
 */
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

function row(id: string, lastMessageAt: string): AssistantConversation {
  return { id, title: id, createdAt: lastMessageAt, lastMessageAt, expiresAt: lastMessageAt, messageCount: 2 }
}

describe('assistant history groups', () => {
  const now = new Date(2026, 9, 26, 9, 30)

  it('splits at local midnight, not at UTC midnight', () => {
    expect(historyGroupOf(at(2026, 10, 26, 0, 1), now)).toBe('today')
    expect(historyGroupOf(at(2026, 10, 25, 23, 59), now)).toBe('yesterday')
    expect(historyGroupOf(at(2026, 10, 25, 0, 0), now)).toBe('yesterday')
    expect(historyGroupOf(at(2026, 10, 24, 23, 59), now)).toBe('earlier')
  })

  it('keeps the server order inside each group and leaves empty groups out', () => {
    const groups = groupConversations(
      [row('a', at(2026, 10, 26, 9)), row('b', at(2026, 10, 26, 8)), row('c', at(2026, 10, 20, 8))],
      now,
    )
    expect(groups.map(group => [group.key, group.items.map(item => item.id)])).toEqual([
      ['today', ['a', 'b']],
      ['earlier', ['c']],
    ])
  })

  it('a month boundary still finds yesterday', () => {
    const first = new Date(2026, 10, 1, 8)
    expect(historyGroupOf(at(2026, 10, 31, 22), first)).toBe('yesterday')
  })
})
