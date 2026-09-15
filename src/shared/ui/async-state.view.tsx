import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, Text, View } from 'react-native'

import { isForbidden, isOffline } from '@/shared/api'
import { currentOfflineSpell, useOnlineStatus } from '@/shared/api/queries/use-online-status'
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

/** The offline spell already announced; one announcement per spell, app-wide. */
let announcedSpell = 0

/**
 * Speaks `message` once when the offline signal turns on (GoGo-MobileApp#253).
 * `accessibilityLiveRegion` only exists on Android, so VoiceOver heard nothing.
 * Every screen with a notice mounts this, which is why it is keyed to the
 * offline spell rather than to the component: a stack of screens, a rerender or
 * a second notice must not repeat it.
 */
export function useOfflineAnnouncement(active: boolean, message: string) {
  const online = useOnlineStatus()
  const speak = active && !online
  useEffect(() => {
    if (!speak) return
    const spell = currentOfflineSpell()
    if (spell === announcedSpell) return
    announcedSpell = spell
    AccessibilityInfo.announceForAccessibility(message)
  }, [speak, message])
}

/**
 * Nothing cached, and the query is waiting for the network (GoGo-MobileApp#253).
 * Offline TanStack Query keeps such a query pending, so without this the screen
 * shows its skeleton forever. No retry: it would pause again, and the query
 * resumes by itself on reconnect.
 */
export function OfflineState() {
  const { t } = useTranslation()
  useOfflineAnnouncement(true, t('common.offlineBody'))
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <Text style={styles.title}>{t('common.offlineTitle')}</Text>
      <Text style={styles.body}>{t('common.offlineBody')}</Text>
    </View>
  )
}

/**
 * Cached data on screen that may be old. The data stays — it is what the user
 * came back for — and this says how much to trust it (APP-007). Showing the
 * error screen instead throws away a perfectly readable plan.
 *
 * Two causes, one signal (GoGo-MobileApp#253): the last refresh failed, or the
 * device is offline. Offline has to come from connectivity, not from `error`:
 * while offline TanStack Query pauses a refetch instead of failing it, so a
 * notice that waited for an error never appeared in airplane mode.
 *
 * `hasData` says whether cached data is actually on screen; with nothing cached
 * the screen's own loading/error state speaks instead. `reportOffline={false}`
 * is for a section inside a screen that already carries the offline bar: it
 * keeps only the failed-refresh variant, so a screen never shows two bars.
 * Retry is offered only online — offline it would pause again and do nothing.
 */
export function StaleNotice({
  error,
  onRetry,
  hasData = true,
  reportOffline = true,
}: {
  error: unknown
  onRetry?: () => void
  hasData?: boolean
  reportOffline?: boolean
}) {
  const { t } = useTranslation()
  const online = useOnlineStatus()
  const offline = !online || isOffline(error)
  const shown = hasData && (offline ? reportOffline : Boolean(error))
  useOfflineAnnouncement(shown, t('common.staleOffline'))
  if (!shown) return null
  return (
    <View style={styles.staleBar} accessibilityLiveRegion="polite">
      <Text style={styles.staleLabel} numberOfLines={2}>
        {offline ? t('common.staleOffline') : t('common.staleError')}
      </Text>
      {onRetry && online ? <GhostBtn label={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  )
}
