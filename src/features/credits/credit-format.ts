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
