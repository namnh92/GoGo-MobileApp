import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '@/shared/api'
import { track } from '@/shared/analytics'
import { env } from '@/shared/config/env'
import { useSession } from '@/shared/providers/session-provider'
import { locales } from '@/shared/i18n'
import { useRoom, type DemoAudience, type DemoUIState } from '@/shared/store/roomStore'
import { Atmosphere, AvatarCircle, GlassCard, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { IconChevronRight } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './profile.style'

/** Only rows with a destination are tappable. */
const SETTINGS_ROWS: readonly { key: string; route?: string }[] = [
  { key: 'inbox', route: '/notifications' },
  { key: 'notifications', route: '/settings/notifications' },
  { key: 'reviews', route: '/settings/reviews' },
  { key: 'location' },
  { key: 'privacy' },
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

  async function signOutNow() {
    setSigningOut(true)
    try {
      // Revokes server-side, wipes the Keychain, and purges every cached room.
      await signOut()
      track('auth_signed_out')
      router.replace('/(tabs)')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[2], paddingBottom: dockInset }}>
        <View style={styles.headerRow}>
          <AvatarCircle label={(me.data?.displayName ?? '?').trim().charAt(0).toUpperCase()} size={64} />
          <View>
            <Text style={styles.name}>{me.data?.displayName ?? t('profile.guestName')}</Text>
            {/* Guests have no email; showing a placeholder would be a lie. */}
            <Text style={styles.email}>{me.data?.email ?? t('profile.guestSubtitle')}</Text>
          </View>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.caption}>{t('profile.couple')}</Text>
          <View style={styles.coupleRow}>
            <AvatarCircle label="M" size={40} />
            <Text style={{ color: colors.neutral[300], fontSize: 20 }}>+</Text>
            <AvatarCircle emoji="😊" size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.coupleTagline}>{t('profile.coupleTagline')}</Text>
              <Text style={styles.coupleSince}>{t('profile.coupleSince')}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.caption}>{t('profile.prefsTitle')}</Text>
          <Text style={styles.prefLabel}>{t('profile.likes')}</Text>
          <View style={styles.prefRow}>
            {['🍣 Japanese', '🎨 Creative', '😌 Quiet', '🌃 Night vibe'].map(x => (
              <TagChip key={x} label={x} color="coral" />
            ))}
          </View>
          <Text style={styles.prefLabel}>{t('profile.dislikes')}</Text>
          <View style={[styles.prefRow, { marginBottom: 0 }]}>
            {['🔊 Loud', '👥 Crowded'].map(x => (
              <TagChip key={x} label={x} />
            ))}
          </View>
        </GlassCard>

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
                <Pressable key={a} onPress={() => room.setAudience(a)} style={[styles.segmentBtn, room.audience === a && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentLabel, room.audience === a && styles.segmentLabelActive]}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentRow, { marginTop: spacing[2] }]}>
              {uiStates.map(s => (
                <Pressable key={s} onPress={() => room.setUiState(s)} style={[styles.segmentBtn, room.uiState === s && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentLabel, room.uiState === s && styles.segmentLabelActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segmentRow, { marginTop: spacing[2] }]}>
              {locales.map(l => (
                <Pressable key={l} onPress={() => void i18n.changeLanguage(l)} style={[styles.segmentBtn, i18n.resolvedLanguage === l && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentLabel, i18n.resolvedLanguage === l && styles.segmentLabelActive]}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </GlassCard>
        )}

        {status === 'anonymous' ? (
          <Pressable style={styles.logout} onPress={() => router.push('/auth/sign-in')}>
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
      </ScrollView>
    </Atmosphere>
  )
}
