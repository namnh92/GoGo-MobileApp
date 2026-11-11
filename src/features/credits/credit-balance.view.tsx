import { useCallback } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useMe, useMyCredits } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { Text } from '@/shared/ui/text'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { StaleNotice } from '@/shared/ui/async-state.view'
import { creditsAvailable, formatCredit } from './credit-format'
import { styles } from './credit-balance.style'

export function CreditBalanceRow({ assistant = false }: { assistant?: boolean }) {
  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' })
  const enabled = status === 'user' && creditsAvailable(me.data)
  return enabled ? <CreditBalanceContent assistant={assistant} /> : null
}

function CreditBalanceContent({ assistant }: { assistant: boolean }) {
  const credits = useMyCredits(true)
  const online = useOnlineStatus()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { refetch } = credits
  useFocusEffect(useCallback(() => { void refetch() }, [refetch]))
  const title = t('credits.title')
  return <View style={assistant ? styles.assistant : styles.account} testID="credit-balance-row">
    <Pressable style={({ pressed }) => [styles.row, assistant && styles.assistantRow, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={t('credits.viewHistory')} accessibilityState={{ busy: credits.isPending && online }} onPress={() => router.push('/me/credits')}>
      <Text variant={assistant ? 'bodySmall' : 'body'} numberOfLines={assistant ? 1 : undefined} style={assistant ? undefined : styles.label}>{title}</Text>
      <View accessibilityLiveRegion="polite">
        {credits.data ? <Text variant={assistant ? 'caption' : 'title2'} numberOfLines={assistant ? 1 : undefined}>{formatCredit(assistant ? credits.data.availableBalance : credits.data.balance, i18n.language)}</Text>
          : !online || credits.isPaused ? <Text variant={assistant ? 'caption' : 'body'} numberOfLines={assistant ? 1 : undefined} color="text.secondary">{t('credits.offline')}</Text>
            : credits.isError ? <Text variant={assistant ? 'caption' : 'body'} numberOfLines={assistant ? 1 : undefined} color="text.secondary">{t('credits.unavailable')}</Text>
              : <View testID="credit-balance-loading"><Skeleton width={64} height={24} /></View>}
      </View>
    </Pressable>
    {!credits.data && credits.isError && online ? <GhostBtn label={t('common.retry')} onPress={() => void refetch()} /> : null}
    <StaleNotice hasData={!!credits.data} error={credits.error} onRetry={() => void refetch()} />
  </View>
}
