import { LoadingIndicator } from '@/shared/ui/loading-indicator.view'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Linking, View } from 'react-native'

import { Card, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

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
 * permission, and is edited in Defaults (ADR-0022, ADM-203).
 */
export function LocationPermissionSection({ showSettingsButton = true }: { showSettingsButton?: boolean } = {}) {
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
    <Card appearance="stitch" padded={false} style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.statusIcon}>
          <Icon name="navigation" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.statusText}>
          <View testID="location-permission-title" style={styles.statusTitle}>
            <Text variant="introHeading">{t('locationSettings.statusTitle')}</Text>
          </View>
          {state === 'checking' ? (
            <LoadingIndicator style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text variant={!(blocked) ? 'bodySmall' : blocked ? 'bodySmall' : undefined} color={!(blocked) ? 'text.primary' : blocked ? 'status.warningText' : undefined} accessibilityLiveRegion="polite">
              {t(`locationSettings.status.${state}`)}
            </Text>
          )}
        </View>
      </View>

      <Text variant="introCaption" color="text.secondary">{t('locationSettings.body')}</Text>

      {!showSettingsButton ? <Text variant="bodySmall" color="text.secondary">{t('permissionsSettings.deviceSettingsHint')}</Text> : null}

      {state === 'denied' && showSettingsButton ? (
        <View style={styles.actions}>
          <SecondaryBtn label={t('locationSettings.openSettings')} onPress={() => void Linking.openSettings()} icon="settings" />
        </View>
      ) : state === 'undetermined' ? (
        <View style={styles.actions}>
          <SecondaryBtn label={t('locationSettings.allow')} onPress={allow} icon="navigation" />
        </View>
      ) : state === 'granted' && showSettingsButton ? (
        <View style={styles.actions}>
          <GhostBtn label={t('locationSettings.openSettings')} onPress={() => void Linking.openSettings()} icon="settings" style={styles.inlineAction} />
        </View>
      ) : null}

      <Text variant="caption" color="text.secondary">{t('locationSettings.note')}</Text>
      <GhostBtn label={t('permissionsSettings.areaInDefaults')} onPress={() => router.push('/settings/defaults')} />
    </Card>
  )
}
