import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { isForbidden, isOffline } from '@/shared/api'
import { GhostBtn } from '@/shared/ui/primitives'

import { styles } from './async-state.style'

/**
 * Every async screen owes the user loading / empty / error, plus
 * permission-denied and offline where they apply (RULE-CORE-010). These are the
 * shared renderings so no screen has to invent its own.
 */

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')} style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.body}>{label ?? t('common.loading')}</Text>
    </View>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action}
    </View>
  )
}

/**
 * Maps a thrown error to the right message: a 403 is not a network problem, and
 * being offline is not a server error — telling them apart changes what the
 * user should do next.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation()

  const offline = isOffline(error)
  const forbidden = isForbidden(error)

  const title = offline ? t('common.offlineTitle') : t('common.errorTitle')
  const body = forbidden
    ? t('common.permissionDenied')
    : offline
      ? t('common.offlineBody')
      : t('common.errorBody')

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {/* Retrying a permission failure just fails again. */}
      {onRetry && !forbidden ? <GhostBtn label={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  )
}
