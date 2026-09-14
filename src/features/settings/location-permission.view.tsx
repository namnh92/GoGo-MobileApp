import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, AppState, Linking, Text, View } from 'react-native'

import { GhostBtn, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { IconMapPin } from '@/shared/ui/icons'
import { colors } from '@/shared/ui/tokens'

import { styles } from './location-permission.style'

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
 * What the device says right now; never throws, never prompts. iOS reports a
 * restricted permission (Screen Time, MDM) as `denied`, so it shares that copy,
 * which also offers manual area selection as the way forward.
 */
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

/**
 * PROF-APP-005 (#180), now a section of APP-058 (#216). It shows this device's
 * foreground location permission and the way to change it; it never asks on its
 * own and stores nothing. A profile's default *area* is an account choice, not a
 * permission, and stays in Account information (ADR-0022, ADM-203).
 */
export function LocationPermissionSection() {
  const { t } = useTranslation()
  const router = useRouter()
  const [state, setState] = useState<LocationPermissionState>('checking')

  // Only the newest read may land: a slow read started before a return from
  // Settings must not overwrite the answer read after it.
  const revision = useRef(0)
  const refresh = useCallback(() => {
    const current = ++revision.current
    void readPermission().then(next => {
      if (current === revision.current) setState(next)
    })
  }, [])
  useEffect(() => {
    refresh()
    // "Open Settings, flip the switch, come back" does not change navigation
    // focus, so the app returning to the foreground has to trigger the re-read.
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') refresh()
    })
    return () => {
      revision.current += 1
      subscription.remove()
    }
  }, [refresh])
  useFocusEffect(refresh)

  /** The one place a person can ask for the prompt on purpose. */
  async function allow() {
    const Location = loadLocation()
    if (!Location) return
    try {
      await Location.requestForegroundPermissionsAsync()
    } finally {
      refresh()
    }
  }

  const blocked = state === 'denied' || state === 'unavailable'

  return (
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
      <GhostBtn label={t('permissionsSettings.areaInAccount')} onPress={() => router.push('/settings/account')} />
    </GlassCard>
  )
}
