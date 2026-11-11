import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AssistantStatus, AssistantConversationCredits } from '@/shared/api'
import { CreditBalanceRow } from '@/features/credits/credit-balance.view'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { formatClock, formatShortDate } from './format'
import { styles } from './usage-footer.style'

type Status = { data?: AssistantStatus; isPending: boolean; isError: boolean }

/** Allowance and accounting beneath the composer; missing facts never become zero. */
export function UsageFooter({ status, conversationCredits }: { status: Status; conversationCredits?: AssistantConversationCredits | null }) {
  const { t, i18n } = useTranslation()
  const data = !status.isError && status.data?.state !== 'disabled' ? status.data : undefined
  const reset = data && new Date(data.resetsAt)
  const resetLabel = data && reset
    ? reset.toDateString() === new Date().toDateString()
      ? formatClock(data.resetsAt)
      : `${formatShortDate(data.resetsAt, i18n.language)} · ${formatClock(data.resetsAt)}`
    : ''
  const label = data
    ? data.remainingToday === 0
      ? t('assistant.usage.exhausted', { time: resetLabel })
      : t('assistant.usage.remaining', { remaining: data.remainingToday, limit: data.dailyMessageLimit })
    : null

  return <View testID="assistant-usage-footer" style={styles.row}>
    <View style={styles.allowance} accessibilityLiveRegion="polite">
      {label ? <Text variant="caption" color="text.secondary" numberOfLines={1} ellipsizeMode="middle" accessibilityLabel={label}>{label}</Text>
        : status.isPending ? <View testID="assistant-usage-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}><Skeleton width="80%" /></View>
          : null}
    </View>
    <CreditBalanceRow assistant conversationCredits={conversationCredits} assistantStatus={status.data} />
  </View>
}
