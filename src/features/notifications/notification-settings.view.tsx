import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, AppState, Linking, ScrollView, Switch, Text, View } from 'react-native'

import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  useNotificationPreferences,
  useSetNotificationPreference,
  type NotificationKind,
} from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './notification-settings.style'

/** Every kind the contract defines, so a new one is never silently unreachable. */
const KINDS: readonly NotificationKind[] = [
  'invite',
  'preference_reminder',
  'plan_ready',
  'plan_changed',
  'date_reminder',
  'moderation_update',
]

const CHANNELS = ['push', 'email'] as const

export default function NotificationSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()

  const canEdit = status === 'user'
  const preferences = useNotificationPreferences({ enabled: canEdit })
  const setPreference = useSetNotificationPreference()

  /**
   * What the note says has to come from the device, not from a sentence
   * written at build time. The old copy asserted that APNs/FCM were
   * unconfigured and no device token was registered; by 2026-09-07 both were
   * false on DEV — the device held a token and received a push while the
   * screen said it could not (#149). A screen that contradicts what just
   * happened is worse than a silent one.
   */
  const [pushState, setPushState] = useState<'granted' | 'askable' | 'unknown'>('unknown')
  useFocusEffect(useCallback(() => {
    let cancelled = false
    let revision = 0
    const refresh = () => {
      const currentRevision = ++revision
      setPushState('unknown')
      void pushPermission.status().then(next => {
        if (!cancelled && currentRevision === revision) setPushState(next)
      })
    }
    refresh()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh()
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, []))

  /** Absent means the server default applies, which is on. */
  function isEnabled(channel: (typeof CHANNELS)[number], kind: NotificationKind): boolean {
    // Until the first response arrives there is no truthful value to show.
    // Keep the rows visible but safely off and disabled instead of flashing
    // the contract default on before learning the stored choice.
    if (!preferences.data) return false
    if (channel === 'push' && pushState !== 'granted') return false
    const entry = preferences.data.find(item => item.channel === channel && item.kind === kind)
    return entry?.enabled ?? true
  }

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('notificationSettings.title')} />
    </View>
  )

  if (!canEdit) {
    return (
      <Atmosphere>
        {header}
        <EmptyState
          title={t('notifications.signInTitle')}
          body={t('notifications.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />}
        />
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
      >
        {!preferences.data ? (
          <View accessibilityLiveRegion="polite" style={styles.syncState}>
            {preferences.isPending ? (
              <>
                <ActivityIndicator color={colors.brand.coral} size="small" />
                <Text style={styles.syncText}>{t('common.loading')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.error}>{t('notificationSettings.loadFailed')}</Text>
                <GhostBtn label={t('common.retry')} onPress={() => void preferences.refetch()} />
              </>
            )}
          </View>
        ) : null}

        {CHANNELS.map(channel => (
          <View key={channel}>
            <Text style={styles.sectionTitle}>{t(`notificationSettings.channel.${channel}`)}</Text>
            <GlassCard style={styles.card}>
              {KINDS.map((kind, index) => {
                const enabled = isEnabled(channel, kind)
                return (
                  <View
                    key={kind}
                    style={[styles.row, index === KINDS.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <Text style={styles.rowLabel}>{t(`notifications.kind.${kind}`)}</Text>
                    <Switch
                      value={enabled}
                      // One PUT per toggle; the list refetches so the server
                      // stays the source of truth for what is actually set.
                      onValueChange={next => {
                        if (channel === 'push' && pushState !== 'granted') return
                        setPreference.mutate({ channel, kind, enabled: next })
                      }}
                      disabled={!preferences.data || setPreference.isPending || (channel === 'push' && pushState !== 'granted')}
                      trackColor={{ true: colors.brand.coral, false: colors.neutral[100] }}
                      accessibilityLabel={`${t(`notificationSettings.channel.${channel}`)} · ${t(`notifications.kind.${kind}`)}`}
                    />
                  </View>
                )
              })}
            </GlassCard>
          </View>
        ))}

        {pushState !== 'granted' && <GhostBtn label={t('notificationSettings.openSettings')} onPress={() => { void Linking.openSettings().catch(() => {}) }} />}
        <Text style={styles.note}>
          {t(pushState === 'granted' ? 'notificationSettings.pushReady' : 'notificationSettings.pushNote')}
        </Text>

        {setPreference.isError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {t('notificationSettings.saveFailed')}
          </Text>
        ) : null}
      </ScrollView>
    </Atmosphere>
  )
}
