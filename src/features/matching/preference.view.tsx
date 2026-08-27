import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isApiError,
  useCompleteMyPreferences,
  useMyPreferences,
  useSaveMyPreferences,
  useTaxonomies,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { useRoomStore } from '@/shared/store/roomStore'
import { ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { taxonomyEmoji } from '@/features/create-date/taxonomy-emoji'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './preference.style'

const MAX_PREFS = 3
/** The kind this screen collects; the wizard already collected mood/setting. */
const TAXONOMY_KIND = 'mood'

export default function PreferenceScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  // Whatever the host picked in the create wizard seeds their own preferences,
  // so the choice is not silently thrown away between the two screens.
  const draftMoodKeys = useRoomStore(state => state.moodKeys)

  const taxonomies = useTaxonomies({ kinds: TAXONOMY_KIND })
  const preferences = useMyPreferences(roomId)
  const savePreferences = useSaveMyPreferences(roomId)
  const completePreferences = useCompleteMyPreferences(roomId)

  /** Null until the user touches a chip; the saved draft shows through. */
  const [edited, setEdited] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const savedSelection = useMemo(
    () => preferences.data?.selections?.[TAXONOMY_KIND] ?? null,
    [preferences.data],
  )

  // Derived, not synced in an effect: the server draft wins, and the wizard's
  // picks only fill an empty one.
  const selected =
    edited ?? (savedSelection && savedSelection.length > 0 ? savedSelection : draftMoodKeys)

  const options = useMemo(() => {
    const entries = taxonomies.data?.kinds?.[TAXONOMY_KIND] ?? []
    return entries.map(entry => ({
      key: entry.key ?? '',
      label: entry.labels?.[i18n.language] ?? entry.labels?.vi ?? entry.key ?? '',
      emoji: taxonomyEmoji(entry.key ?? ''),
    }))
  }, [taxonomies.data, i18n.language])

  function toggle(key: string) {
    setEdited(prev => {
      const current = prev ?? selected
      if (current.includes(key)) return current.filter(x => x !== key)
      return current.length < MAX_PREFS ? [...current, key] : current
    })
  }

  async function complete() {
    setError(null)
    const keys = selected

    try {
      // Save, then mark complete: the room only flips to matching once every
      // member has completed, so the two calls must both land.
      await savePreferences.mutateAsync({
        selections: { [TAXONOMY_KIND]: keys },
        expectedVersion: preferences.data?.version ?? 0,
      })
      await completePreferences.mutateAsync()

      track('preference_completed', { count: keys.length })
      router.push(`/room/${roomId}/swipe`)
    } catch (caught) {
      // 409 means another device saved first — refetch and let them re-apply
      // rather than silently overwriting the other draft.
      setError(
        isApiError(caught) && caught.status === 409
          ? t('preference.conflict')
          : t('preference.saveFailed'),
      )
    }
  }

  if (taxonomies.isPending || preferences.isPending) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
        </View>
        <LoadingState />
      </Atmosphere>
    )
  }

  if (taxonomies.isError || preferences.isError) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
        </View>
        <ErrorState
          error={taxonomies.error ?? preferences.error}
          onRetry={() => {
            void taxonomies.refetch()
            void preferences.refetch()
          }}
        />
      </Atmosphere>
    )
  }

  const pending = savePreferences.isPending || completePreferences.isPending

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('preference.title')}</Text>
        <Text style={styles.body}>{t('preference.body')}</Text>

        <View style={styles.grid}>
          {options.map(option => {
            const active = selected.includes(option.key)
            return (
              <Pressable
                key={option.key}
                onPress={() => toggle(option.key)}
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                {option.emoji ? <Text style={{ fontSize: 24 }}>{option.emoji}</Text> : null}
                <Text style={[styles.optionLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn
          label={`${t('common.continue')}${selected.length > 0 ? ` (${selected.length})` : ''}`}
          onPress={complete}
          loading={pending}
        />
      </View>
    </Atmosphere>
  )
}
