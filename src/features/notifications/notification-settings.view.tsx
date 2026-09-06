import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, Switch, Text, View } from 'react-native'

import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  useNotificationPreferences,
  useSetNotificationPreference,
  type NotificationKind,
} from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
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

  /** Absent means the server default applies, which is on. */
  function isEnabled(channel: (typeof CHANNELS)[number], kind: NotificationKind): boolean {
    const entry = preferences.data?.find(item => item.channel === channel && item.kind === kind)
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

  if (preferences.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  if (preferences.isError) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
      >
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
                        // NTF-APP-003: the contextual moment. Someone turning a
                        // push channel *on* has just told us why they want
                        // notifications, which is the only point at which
                        // spending the one OS prompt is defensible — and the
                        // point at which sending them to Settings, if the
                        // prompt is already spent, is help rather than
                        // hostility. The preference is recorded either way:
                        // permission governs delivery, not intent.
                        if (channel === 'push' && next) void pushPermission.request({ fallbackToSettings: true })
                        setPreference.mutate({ channel, kind, enabled: next })
                      }}
                      disabled={setPreference.isPending}
                      trackColor={{ true: colors.brand.coral, false: colors.neutral[100] }}
                      accessibilityLabel={`${t(`notificationSettings.channel.${channel}`)} · ${t(`notifications.kind.${kind}`)}`}
                    />
                  </View>
                )
              })}
            </GlassCard>
          </View>
        ))}

        {/*
          Push delivery also needs a device token, which needs a real device and
          APNs/FCM credentials — neither is configured yet, so the app registers
          none. These switches record the preference regardless.
        */}
        <Text style={styles.note}>{t('notificationSettings.pushNote')}</Text>

        {setPreference.isError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {t('notificationSettings.saveFailed')}
          </Text>
        ) : null}
      </ScrollView>
    </Atmosphere>
  )
}
