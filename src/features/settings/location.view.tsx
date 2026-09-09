import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Atmosphere, BackHeader, GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { IconMapPin } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './location.style'

export type LocationPermissionState = 'checking' | 'granted' | 'undetermined' | 'denied' | 'unavailable'

type LocationModule = typeof import('expo-location')

/** Same lazy load as `use-current-location.ts`: an old binary must not crash the screen. */
function loadLocation(): LocationModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as LocationModule
  } catch {
    return null
  }
}

/**
 * PROF-APP-005 (#180) — what the "Vị trí" row leads to. It shows the state of
 * the foreground permission on this device and the way to change it; it never
 * asks on its own, and it stores nothing. The app uses a location only when
 * the person taps "Vị trí hiện tại" while creating a date (APP-005), and a
 * profile carries a home *area*, never a position (ADR-0022).
 */
/** What the device says right now; never throws, never prompts. */
async function readPermission(): Promise<LocationPermissionState> {
  const Location = loadLocation()
  if (!Location) return 'unavailable'
  try {
    const permission = await Location.getForegroundPermissionsAsync()
    return permission.granted ? 'granted' : permission.status === 'undetermined' ? 'undetermined' : 'denied'
  } catch {
    return 'unavailable'
  }
}

export default function LocationSettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [state, setState] = useState<LocationPermissionState>('checking')

  // On mount, and again whenever the screen regains focus: the common path is
  // "open Settings, flip the switch, come back", and the row must read true.
  // The read is asynchronous and the effect only subscribes to its answer.
  const refresh = useCallback(() => {
    let cancelled = false
    void readPermission().then(next => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(refresh, [refresh])
  useFocusEffect(refresh)

  /** The one place a person can ask for the prompt on purpose. */
  async function allow() {
    const Location = loadLocation()
    if (!Location) return
    try {
      await Location.requestForegroundPermissionsAsync()
    } finally {
      setState(await readPermission())
    }
  }

  const blocked = state === 'denied' || state === 'unavailable'

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} title={t('locationSettings.title')} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}>
        <GlassCard style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.statusIcon}>
              <IconMapPin />
            </View>
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>{t('locationSettings.statusTitle')}</Text>
              {state === 'checking' ? (
                <ActivityIndicator color={colors.brand.coral} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <Text accessibilityLiveRegion="polite" style={blocked ? styles.statusBlocked : styles.status}>
                  {t(`locationSettings.status.${state}`)}
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.body}>{t('locationSettings.body')}</Text>

          {state === 'denied' ? (
            <View style={styles.actions}>
              <SecondaryBtn label={t('locationSettings.openSettings')} onPress={() => void Linking.openSettings()} />
            </View>
          ) : state === 'undetermined' ? (
            <View style={styles.actions}>
              <SecondaryBtn label={t('locationSettings.allow')} onPress={allow} />
            </View>
          ) : state === 'granted' ? (
            <View style={styles.actions}>
              <GhostBtn label={t('locationSettings.openSettings')} onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}

          <Text style={styles.note}>{t('locationSettings.note')}</Text>
        </GlassCard>
      </ScrollView>
    </Atmosphere>
  )
}
