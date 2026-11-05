import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useUnreadInbox } from '@/features/notifications/unread-count'
import { CountBadge } from '@/shared/ui/count-badge.view'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe, useMyReviews, useNotificationSettings, useSaved } from '@/shared/api'
import { track } from '@/shared/analytics'
import { getSession, type Session } from '@/shared/api/session'
import { env } from '@/shared/config/env'
import { useSession } from '@/shared/providers/session-provider'
import { signOutFailureReason, type SignOutFailure } from '@/shared/providers/sign-out-failure'
import { locales } from '@/shared/i18n'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useRoom, type DemoAudience, type DemoUIState } from '@/shared/store/roomStore'
import { Atmosphere, AvatarCircle, Card } from '@/shared/ui/primitives'
import { Icon, IconChevronRight, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { AssistantHelpSection } from '@/features/assistant/assistant-help-row.view'
import { SETTINGS_ROWS } from './profile-settings-rows'
import { styles } from './profile.style'

const audiences: DemoAudience[] = ['couple', 'group-host', 'group-guest']
const uiStates: DemoUIState[] = ['default', 'loading', 'empty', 'error']

/** Presentation only: the glyph that leads each shortcut card. */
const SHORTCUT_ICON: Record<string, IconName> = { saved: 'bookmark', plans: 'users', reviews: 'star' }

/** Who a session belongs to; a token refresh keeps it. */
function actorKeyOf(session: Session | null): string {
  return session ? `${session.kind}:${session.userId ?? ''}:${session.guestSessionId ?? ''}` : ''
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const room = useRoom()
  const router = useRouter()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('profile')
  const unread = useUnreadInbox()
  const { session, status, signOut } = useSession()
  const me = useMe({ enabled: status === 'user' || status === 'guest' })
  const [signingOut, setSigningOut] = useState(false)
  // The tab stays mounted across sign-out and sign-in, so a refusal belongs to
  // the actor it happened to and is shown only while that actor is current: a
  // different person — or the next sign-in after an ended session — must not
  // inherit it (#279 F-03). Tagged by actor rather than cleared by an effect,
  // so it cannot race the session change that arrives in the same tick, and a
  // token refresh (same actor) does not hide a message not yet read.
  const [failed, setFailed] = useState<{ reason: SignOutFailure; actor: string } | null>(null)
  const actor = actorKeyOf(session)
  const signOutFailure = failed && failed.actor === actor ? failed.reason : null

  // Counts come from the same queries the destination screens use, so a
  // shortcut never promises a number the screen behind it does not have.
  const canRead = status === 'user'
  const saved = useSaved({ enabled: canRead })
  const reviews = useMyReviews({ enabled: canRead })
  // Warm the persisted cache while the person is already on Profile. Opening
  // notification settings then has data on the first frame in the usual flow.
  useNotificationSettings({ enabled: canRead })
  const recentRooms = useRecentRoomsStore(state => state.rooms)

  const shortcuts: { key: string; route: string; count: number | null }[] = [
    { key: 'saved', route: '/(tabs)/saved', count: canRead ? (saved.data?.length ?? null) : null },
    { key: 'plans', route: '/(tabs)/plans', count: recentRooms.length },
    { key: 'reviews', route: '/settings/reviews', count: canRead ? (reviews.data?.length ?? null) : null },
  ]

  async function signOutNow() {
    setSigningOut(true)
    setFailed(null)
    try {
      // Unsubscribes this device and has the provider confirm it, revokes
      // server-side, and only then wipes the Keychain and cached rooms.
      await signOut()
      track('auth_signed_out')
      router.replace('/(tabs)')
    } catch (error) {
      // NTF-APP-004 (#160): a sign-out that did not happen has to say so.
      // Without this the rejection is unhandled — a dev-build toast, and in a
      // release build nothing at all, leaving a button that silently does
      // nothing while the person believes they signed out. #279: and it has to
      // say why, so nobody is sent to check a connection that is fine.
      const current = getSession()
      const reason = signOutFailureReason(error, current !== null)
      track('auth_sign_out_failed', { reason })
      setFailed({ reason, actor: actorKeyOf(current) })
      // The credential was already dead and the session ended locally (F-02):
      // the person is signed out, so they go where a sign-out goes.
      if (reason === 'session_ended') router.replace('/(tabs)')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Atmosphere>
      <ScrollView
        testID="profile-list"
        onScroll={fab.onScroll}
        scrollEventThrottle={fab.scrollEventThrottle}
        contentContainerStyle={{ paddingTop: insets.top + spacing[2], paddingBottom: fab.bottomInset }}
      >
        <Card padded={false} style={styles.headerCard}>
          <AvatarCircle
            label={(me.data?.displayName ?? '?').trim().charAt(0).toUpperCase()}
            size={64}
            imageUri={me.data?.avatarUrl}
          />
          <View style={styles.headerText}>
            <Text variant="title1" numberOfLines={1}>{me.data?.displayName ?? t('profile.guestName')}</Text>
            {/* Guests have no email; showing a placeholder would be a lie. */}
            <Text variant="bodySmall" color="text.secondary" numberOfLines={1} style={styles.email}>{me.data?.email ?? t('profile.guestSubtitle')}</Text>
          </View>
        </Card>

        {/* Under the header card, as drawn: at the end of the list the assistant
            button covered it until the person scrolled. */}
        {status === 'anonymous' ? (
          <Pressable
            accessibilityRole="button"
            style={styles.signIn}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text variant="label" color="accent.onAccent">{t('auth.signInCta')}</Text>
          </Pressable>
        ) : null}

        {/*
          The two cards that stood here were fabricated: a "couple" pairing the
          contract does not model, and a preferences list hard-coded in English
          ("Japanese", "Night vibe") rather than resolved from taxonomy keys.
          Both broke RULE-CORE-002 and RULE-CORE-003, and neither told the user
          anything true. Replaced with the three places a profile actually
          leads, carrying real counts.
        */}
        <View style={styles.shortcutRow}>
          {shortcuts.map(shortcut => (
            <Pressable
              key={shortcut.key}
              accessibilityRole="button"
              accessibilityLabel={
                shortcut.count == null
                  ? t(`profile.shortcut.${shortcut.key}`)
                  : `${t(`profile.shortcut.${shortcut.key}`)}: ${shortcut.count}`
              }
              onPress={() => router.push(shortcut.route)}
              style={{ flex: 1 }}
            >
              <Card padded={false} style={styles.shortcut}>
                <View style={styles.shortcutIcon}>
                  <Icon name={SHORTCUT_ICON[shortcut.key] ?? 'star'} size={20} color="accent.onSoft" />
                </View>
                {/* A dash, not a zero: an unknown count and an empty list are
                    different facts, and only one of them is reassuring. */}
                <Text variant={!(shortcut.count == null) ? 'title1' : shortcut.count == null ? 'title1' : undefined} color={!(shortcut.count == null) ? 'text.primary' : shortcut.count == null ? 'text.secondary' : undefined}>
                  {shortcut.count ?? '—'}
                </Text>
                <Text variant="caption" color="text.secondary" style={styles.shortcutLabel}>{t(`profile.shortcut.${shortcut.key}`)}</Text>
              </Card>
            </Pressable>
          ))}
        </View>

        <Card padded={false} style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          {SETTINGS_ROWS.map((row, index) => (
            <Pressable
              key={row.key}
              onPress={() => (row.route ? router.push(row.route) : undefined)}
              // A row with nowhere to go says so instead of silently doing
              // nothing when tapped.
              disabled={!row.route}
              accessibilityRole="button"
              accessibilityState={{ disabled: !row.route }}
              testID={`profile-setting-${t(`profile.settings.${row.key}`)}`}
              // Pressed is a colour change (#382) — the rows had no pressed state.
              style={({ pressed }) => [
                styles.settingRow,
                index === SETTINGS_ROWS.length - 1 && styles.settingRowLast,
                pressed && !!row.route && styles.settingRowPressed,
              ]}
            >
              <View style={styles.settingLead}>
                <View style={styles.settingIconTile}>
                  <Icon name={row.icon} size={20} color={row.route ? 'text.primary' : 'text.secondary'} />
                </View>
                {/* A row with nowhere to go reads `text.secondary`, the measured
                    disabled colour — never the 1.6:1 placeholder (#382). */}
                <Text color={row.route ? 'text.primary' : 'text.secondary'} style={styles.settingLabel}>
                  {t(`profile.settings.${row.key}`)}
                </Text>
              </View>
              {row.key === 'inbox' ? <CountBadge count={unread.count} more={unread.more} style={styles.inboxBadge} /> : null}
              {row.route ? (
                <IconChevronRight />
              ) : (
                <Text variant="caption" color="text.secondary">{t('profile.settings.comingSoon')}</Text>
              )}
            </Pressable>
          ))}
        </Card>

        {/* Help › GoGo AI (#379), behind the assistant gate. */}
        <AssistantHelpSection />

        {/* Demo controls (dev only): audience × UI state are independent
            dimensions (spec v3 §22); stripped from production builds. */}
        {__DEV__ && (
          <Card padded={false} style={styles.card}>
            <Text variant="caption" color="text.secondary" style={styles.caption}>Demo · {env.name}</Text>
            <View style={styles.segmentRow}>
              {audiences.map(a => (
                <Pressable
                  key={a}
                  accessibilityRole="button"
                  onPress={() => room.setAudience(a)}
                  style={[styles.segmentBtn, room.audience === a && styles.segmentBtnActive]}
                >
                  <Text variant="caption" color={room.audience === a ? 'text.inverse' : 'text.secondary'}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentRow, { marginTop: spacing[2] }]}>
              {uiStates.map(s => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  onPress={() => room.setUiState(s)}
                  style={[styles.segmentBtn, room.uiState === s && styles.segmentBtnActive]}
                >
                  <Text variant="caption" color={room.uiState === s ? 'text.inverse' : 'text.secondary'}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentRow, { marginTop: spacing[2] }]}>
              {locales.map(l => (
                <Pressable
                  key={l}
                  accessibilityRole="button"
                  onPress={() => void i18n.changeLanguage(l)}
                  style={[styles.segmentBtn, i18n.resolvedLanguage === l && styles.segmentBtnActive]}
                >
                  <Text variant="caption" color={i18n.resolvedLanguage === l ? 'text.inverse' : 'text.secondary'}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        {status === 'anonymous' ? null : (
          <Pressable
            style={styles.logout}
            onPress={signOutNow}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel={signingOut ? t('profile.loggingOut') : t('profile.logout')}
            accessibilityState={{ disabled: signingOut, busy: signingOut }}
          >
            <Text variant="label" color="accent.onSoft">
              {signingOut ? t('profile.loggingOut') : t('profile.logout')}
            </Text>
          </Pressable>
        )}
        {signOutFailure && (
          <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.logoutError}>
            {/* A literal lookup, so the i18n key scan reads every key this can
                ask for, and `satisfies` makes tsc demand copy for every reason. */}
            {t(
              ({
                offline: 'profile.logoutFailedOffline',
                timeout: 'profile.logoutFailedTimeout',
                push_unconfirmed: 'profile.logoutFailedPush',
                session_ended: 'profile.logoutSessionEnded',
                other: 'profile.logoutFailed',
              } as const satisfies Record<SignOutFailure, string>)[signOutFailure],
            )}
          </Text>
        )}
      </ScrollView>
    </Atmosphere>
  )
}
