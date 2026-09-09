import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe, useMyReviews, useSaved } from '@/shared/api'
import { track } from '@/shared/analytics'
import { env } from '@/shared/config/env'
import { useSession } from '@/shared/providers/session-provider'
import { locales } from '@/shared/i18n'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useRoom, type DemoAudience, type DemoUIState } from '@/shared/store/roomStore'
import { Atmosphere, AvatarCircle, GlassCard, useTabDockInset } from '@/shared/ui/primitives'
import { IconChevronRight } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './profile.style'

/**
 * Only rows with a destination are tappable. Every row has one now: the
 * location row leads to the permission state on this device (PROF-APP-005),
 * and what the privacy row promised — export and delete — lives on the account
 * screen, so a second row would have been a duplicate door.
 */
const SETTINGS_ROWS: readonly { key: string; route?: string }[] = [
  { key: 'inbox', route: '/notifications' },
  { key: 'notifications', route: '/settings/notifications' },
  { key: 'reviews', route: '/settings/reviews' },
  { key: 'location', route: '/settings/location' },
  { key: 'account', route: '/settings/account' },
]

const audiences: DemoAudience[] = ['couple', 'group-host', 'group-guest']
const uiStates: DemoUIState[] = ['default', 'loading', 'empty', 'error']

export default function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()
  const room = useRoom()
  const router = useRouter()
  const dockInset = useTabDockInset()
  const { status, signOut } = useSession()
  const me = useMe({ enabled: status === 'user' || status === 'guest' })
  const [signingOut, setSigningOut] = useState(false)
  const [signOutFailed, setSignOutFailed] = useState(false)

  // Counts come from the same queries the destination screens use, so a
  // shortcut never promises a number the screen behind it does not have.
  const canRead = status === 'user'
  const saved = useSaved({ enabled: canRead })
  const reviews = useMyReviews({ enabled: canRead })
  const recentRooms = useRecentRoomsStore(state => state.rooms)

  const shortcuts: { key: string; route: string; count: number | null }[] = [
    { key: 'saved', route: '/(tabs)/saved', count: canRead ? (saved.data?.length ?? null) : null },
    { key: 'plans', route: '/(tabs)/plans', count: recentRooms.length },
    { key: 'reviews', route: '/settings/reviews', count: canRead ? (reviews.data?.length ?? null) : null },
  ]

  async function signOutNow() {
    setSigningOut(true)
    setSignOutFailed(false)
    try {
      // Unsubscribes this device and has the provider confirm it, revokes
      // server-side, and only then wipes the Keychain and cached rooms.
      await signOut()
      track('auth_signed_out')
      router.replace('/(tabs)')
    } catch {
      // NTF-APP-004 (#160): a sign-out that did not happen has to say so.
      // Without this the rejection is unhandled — a dev-build toast, and in a
      // release build nothing at all, leaving a button that silently does
      // nothing while the person believes they signed out.
      setSignOutFailed(true)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[2], paddingBottom: dockInset }}>
        <View style={styles.headerRow}>
          <AvatarCircle
            label={(me.data?.displayName ?? '?').trim().charAt(0).toUpperCase()}
            size={64}
            imageUri={me.data?.avatarUrl}
          />
          <View>
            <Text style={styles.name}>{me.data?.displayName ?? t('profile.guestName')}</Text>
            {/* Guests have no email; showing a placeholder would be a lie. */}
            <Text style={styles.email}>{me.data?.email ?? t('profile.guestSubtitle')}</Text>
          </View>
        </View>

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
              <GlassCard style={styles.shortcut}>
                {/* A dash, not a zero: an unknown count and an empty list are
                    different facts, and only one of them is reassuring. */}
                <Text style={shortcut.count == null ? styles.shortcutValueMuted : styles.shortcutValue}>
                  {shortcut.count ?? '—'}
                </Text>
                <Text style={styles.shortcutLabel}>{t(`profile.shortcut.${shortcut.key}`)}</Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>

        <GlassCard style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          {SETTINGS_ROWS.map((row, index) => (
            <Pressable
              key={row.key}
              onPress={() => (row.route ? router.push(row.route) : undefined)}
              // A row with nowhere to go says so instead of silently doing
              // nothing when tapped.
              disabled={!row.route}
              accessibilityRole="button"
              accessibilityState={{ disabled: !row.route }}
              style={[styles.settingRow, index === SETTINGS_ROWS.length - 1 && { borderBottomWidth: 0 }]}
            >
              {/* Genuinely disabled (`disabled={!row.route}` above), so the lighter
                  neutral is the signal rather than a contrast failure. */}
              <Text style={[styles.settingLabel, !row.route && { color: colors.neutral[300] }]}>
                {t(`profile.settings.${row.key}`)}
              </Text>
              {row.route ? (
                <IconChevronRight />
              ) : (
                <Text style={styles.settingPending}>{t('profile.settings.comingSoon')}</Text>
              )}
            </Pressable>
          ))}
        </GlassCard>

        {/* Demo controls (dev only): audience × UI state are independent
            dimensions (spec v3 §22); stripped from production builds. */}
        {__DEV__ && (
          <GlassCard style={styles.card}>
            <Text style={styles.caption}>Demo · {env.name}</Text>
            <View style={styles.segmentRow}>
              {audiences.map(a => (
                <Pressable
                  key={a}
                  accessibilityRole="button"
                  onPress={() => room.setAudience(a)}
                  style={[styles.segmentBtn, room.audience === a && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentLabel, room.audience === a && styles.segmentLabelActive]}>{a}</Text>
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
                  <Text style={[styles.segmentLabel, room.uiState === s && styles.segmentLabelActive]}>{s}</Text>
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
                  <Text style={[styles.segmentLabel, i18n.resolvedLanguage === l && styles.segmentLabelActive]}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        )}

        {status === 'anonymous' ? (
          <Pressable
            accessibilityRole="button"
            style={styles.logout}
            onPress={() => router.push('/auth/sign-in')}
          >
            <Text style={styles.logoutLabel}>{t('auth.signInCta')}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.logout}
            onPress={signOutNow}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut, busy: signingOut }}
          >
            <Text style={styles.logoutLabel}>
              {signingOut ? t('profile.loggingOut') : t('profile.logout')}
            </Text>
          </Pressable>
        )}
        {signOutFailed && (
          <Text accessibilityLiveRegion="polite" style={styles.logoutError}>
            {t('profile.logoutFailed')}
          </Text>
        )}
      </ScrollView>
    </Atmosphere>
  )
}
