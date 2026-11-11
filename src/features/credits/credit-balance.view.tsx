import { useCallback } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useMe, useMyCredits, type AssistantConversationCredits, type AssistantStatus } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { Text } from '@/shared/ui/text'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { StaleNotice } from '@/shared/ui/async-state.view'
import { creditsAvailable, formatCredit } from './credit-format'
import { styles } from './credit-balance.style'

type CreditBalanceProps = {
  assistant?: boolean
  /** null is a new unsaved chat; undefined is an aggregate that has not loaded. */
  conversationCredits?: AssistantConversationCredits | null
  assistantStatus?: AssistantStatus
}
export function CreditBalanceRow({ assistant = false, ...props }: CreditBalanceProps) {
  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' })
  const enabled = status === 'user' && creditsAvailable(me.data)
  return enabled ? <CreditBalanceContent assistant={assistant} {...props} /> : null
}

function CreditBalanceContent({ assistant, conversationCredits, assistantStatus }: CreditBalanceProps) {
  const credits = useMyCredits(true)
  const online = useOnlineStatus()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { refetch } = credits
  useFocusEffect(useCallback(() => { void refetch() }, [refetch]))
  const title = t('credits.title')
  const used = conversationCredits === null ? 0 : conversationCredits?.creditsUsed
  const unknown = t('credits.unknown')
  const newerStatus = assistantStatus && (!credits.data || Date.parse(assistantStatus.asOf) > Date.parse(credits.data.asOf))
  const balance = newerStatus ? assistantStatus.creditBalance : credits.data?.balance
  const reserved = newerStatus ? assistantStatus.creditReserved : credits.data?.reserved
  const available = newerStatus ? assistantStatus.creditAvailable : credits.data?.availableBalance
  const amount = (value: number | null | undefined) => value == null ? unknown : formatCredit(value, i18n.language)
  const pending = conversationCredits?.state === 'pending' || (conversationCredits?.pendingTurns ?? 0) > 0
  return <View style={assistant ? styles.assistant : styles.account} testID="credit-balance-row">
    <Pressable style={({ pressed }) => [styles.row, assistant && styles.assistantRow, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={t('credits.viewHistory')} accessibilityState={{ busy: credits.isPending && online }} onPress={() => router.push('/me/credits')}>
      <Text variant={assistant ? 'bodySmall' : 'body'} numberOfLines={assistant ? 1 : undefined} style={assistant ? undefined : styles.label}>{assistant ? `${title}:` : title}</Text>
      <View accessibilityLiveRegion="polite">
        {assistant && balance !== undefined ? <Text variant="caption" numberOfLines={1} accessibilityLabel={t('assistant.credit.usageLabel', { used: amount(used), balance: amount(balance) })}>{amount(used)}/{amount(balance)}</Text>
          : credits.data ? <Text variant={assistant ? 'caption' : 'title2'} numberOfLines={assistant ? 1 : undefined}>{formatCredit(credits.data.balance, i18n.language)}</Text>
          : !online || credits.isPaused ? <Text variant={assistant ? 'caption' : 'body'} numberOfLines={assistant ? 1 : undefined} color="text.secondary">{t('credits.offline')}</Text>
            : credits.isError ? <Text variant={assistant ? 'caption' : 'body'} numberOfLines={assistant ? 1 : undefined} color="text.secondary">{t('credits.unavailable')}</Text>
              : <View testID="credit-balance-loading"><Skeleton width={64} height={24} /></View>}
      </View>
    </Pressable>
    {assistant && pending ? <Text variant="caption" color="text.secondary" accessibilityLiveRegion="polite">{t('credits.pending')}</Text> : null}
    {assistant && (reserved ?? 0) > 0 ? <Text variant="caption" color="text.secondary">{t('assistant.credit.heldAvailable', { held: amount(reserved), available: amount(available) })}</Text> : null}
    {!credits.data && credits.isError && online ? <GhostBtn label={t('common.retry')} onPress={() => void refetch()} /> : null}
    <StaleNotice hasData={!!credits.data} error={credits.error} onRetry={() => void refetch()} />
  </View>
}
