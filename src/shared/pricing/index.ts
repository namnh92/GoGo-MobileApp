import { useTranslation } from 'react-i18next'

import { useRoom } from '@/shared/store/roomStore'

// Single price formatter for every screen (spec v3 §23 / v4 §36). Amounts are
// in thousands of VND (priceK). Per-person figures round UP to the nearest 5k —
// estimates must not fake precision. Group total is the authoritative amount.
const ROUND_K = 5

export function perPersonK(totalK: number, participantCount: number): number {
  return Math.ceil(totalK / participantCount / ROUND_K) * ROUND_K
}

function fmtK(k: number): string {
  return k >= 1000 ? `${(k / 1000).toLocaleString('vi-VN')}.000k` : `${k}k`
}

export function usePriceFormatter() {
  const { t } = useTranslation()
  const { roomType, budgetMode, participantCount } = useRoom()

  /** One stop / place price, e.g. "~450k cho 2 người" | "~115k/người · ~450k tổng nhóm" */
  function stopPrice(priceK: number, { prefix = '~' }: { prefix?: string } = {}): string {
    if (roomType === 'couple') return `${prefix}${fmtK(priceK)} ${t('datePlan.for2')}`
    const per = `${prefix}${fmtK(perPersonK(priceK, participantCount))}${t('datePlan.perPerson')}`
    const total = `${prefix}${fmtK(priceK)} ${t('price.groupTotal')}`
    return budgetMode === 'per_person' ? `${per} · ${total}` : `${total} · ${per}`
  }

  /** Summary total. Group always carries BOTH scopes: total group is
   *  authoritative, per-person is approximate display. */
  function summaryTotal(requiredK: number): { value: string; unit: string; secondary?: string } {
    if (roomType === 'couple') return { value: `~${fmtK(requiredK)}`, unit: t('datePlan.for2') }
    const per = `~${fmtK(perPersonK(requiredK, participantCount))}${t('datePlan.perPerson')}`
    const total = `~${fmtK(requiredK)} ${t('price.groupTotal')}`
    if (budgetMode === 'per_person') {
      return { value: `~${fmtK(perPersonK(requiredK, participantCount))}`, unit: t('datePlan.perPerson'), secondary: total }
    }
    return { value: `~${fmtK(requiredK)}`, unit: t('price.groupTotal'), secondary: per }
  }

  /** One-line plan total for hero/match cards, always scoped. */
  function planTotal(requiredK: number): string {
    if (roomType === 'couple') return `~${fmtK(requiredK)} ${t('datePlan.for2')}`
    const per = `~${fmtK(perPersonK(requiredK, participantCount))}${t('datePlan.perPerson')}`
    const total = `~${fmtK(requiredK)} ${t('price.groupTotal')}`
    return budgetMode === 'per_person' ? `${per} · ${total}` : `${total} · ${per}`
  }

  /** Optional-stop extra, both scopes for group. */
  function optionalExtra(optionalK: number): string {
    if (roomType === 'couple') return t('datePlan.optionalExtra', { amount: `${fmtK(optionalK)} ${t('datePlan.for2')}` })
    const per = `${fmtK(perPersonK(optionalK, participantCount))}${t('datePlan.perPerson')}`
    const total = `${fmtK(optionalK)} ${t('price.groupTotal')}`
    return t('datePlan.optionalExtra', { amount: `${per} · ${total}` })
  }

  return { stopPrice, summaryTotal, planTotal, optionalExtra }
}
