import type { components, Me } from '@/shared/api'

export type CreditEntry = components['schemas']['MyCreditEntry']
export function creditsAvailable(profile?: Me): boolean {
  return profile?.actorType === 'user' && profile.capabilities?.assistantCredits === true
}
export function creditLocale(language: string): string {
  return language.startsWith('vi') ? 'vi-VN' : 'en-US'
}
export function formatCredit(value: number, language: string, signed = false): string {
  return new Intl.NumberFormat(creditLocale(language), { maximumFractionDigits: 0, ...(signed ? { signDisplay: 'always' as const } : {}) }).format(value)
}
export function creditSourceKey(entry: CreditEntry) {
  if (entry.direction === 'adjustment') return 'credits.source.adjustment' as const
  switch (entry.source.type) {
    case 'contribution': return 'credits.source.contribution' as const
    case 'review': return 'credits.source.review' as const
    case 'assistant_usage': return 'credits.source.assistant' as const
    case 'legacy': return 'credits.source.legacy' as const
    default: return 'credits.source.event' as const
  }
}
export function creditEntries(pages?: { items: CreditEntry[] }[]): CreditEntry[] {
  return [...new Map(pages?.flatMap(page => page.items).map(item => [item.id, item])).values()]
}

export interface CreditGroup {
  key: string
  day: string
  date: string
  firstOfDay: boolean
  conversation: CreditEntry['conversation']
  usage: boolean
  entries: CreditEntry[]
  total: number
}

/** Group the loaded cursor pages in local calendar days, then persisted conversations. */
export function groupCreditEntries(entries: CreditEntry[]): CreditGroup[] {
  const days = new Map<string, Map<string, CreditGroup>>()
  for (const entry of entries) {
    const date = new Date(entry.createdAt)
    const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const usage = entry.source.type === 'assistant_usage' || entry.eventKey === 'assistant_usage_adjustment'
    const conversationKey = entry.conversation?.id ?? (usage ? 'deleted' : 'activity')
    let groups = days.get(day)
    if (!groups) { groups = new Map(); days.set(day, groups) }
    let group = groups.get(conversationKey)
    if (!group) {
      group = { key: `${day}:${conversationKey}`, day, date: entry.createdAt,
        firstOfDay: groups.size === 0, conversation: entry.conversation, usage, entries: [], total: 0 }
      groups.set(conversationKey, group)
    }
    group.entries.push(entry)
    group.total += entry.delta
  }
  return [...days.values()].flatMap(groups => [...groups.values()])
}
export function creditEventLabel(entry: CreditEntry, language: string): string | undefined {
  const locale = language.startsWith('vi') ? 'vi' : 'en'
  return entry.eventLabels?.[locale]?.trim() || undefined
}
