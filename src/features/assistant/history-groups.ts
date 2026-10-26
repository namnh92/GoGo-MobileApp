import type { AssistantConversation } from '@/shared/api/types'

/**
 * History groups (GoGo-MobileApp#378, design `HistoryGroup`): exactly
 * "Today", "Yesterday", "Earlier", from `lastMessageAt` in the device's time
 * zone — the server sends no label because it does not know the user's local
 * midnight (contract `listAssistantConversations`). Order inside a group is
 * the server's (newest first); empty groups are left out.
 */
export type HistoryGroupKey = 'today' | 'yesterday' | 'earlier'

export interface HistoryGroupRows {
  key: HistoryGroupKey
  items: AssistantConversation[]
}

function startOfDay(date: Date): number {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

export function historyGroupOf(lastMessageAt: string, now: Date): HistoryGroupKey {
  const at = Date.parse(lastMessageAt)
  const today = startOfDay(now)
  if (at >= today) return 'today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  return at >= yesterday.getTime() ? 'yesterday' : 'earlier'
}

export function groupConversations(items: AssistantConversation[], now: Date): HistoryGroupRows[] {
  const groups: Record<HistoryGroupKey, AssistantConversation[]> = { today: [], yesterday: [], earlier: [] }
  for (const item of items) groups[historyGroupOf(item.lastMessageAt, now)].push(item)
  return (['today', 'yesterday', 'earlier'] as const)
    .filter(key => groups[key].length > 0)
    .map(key => ({ key, items: groups[key] }))
}
