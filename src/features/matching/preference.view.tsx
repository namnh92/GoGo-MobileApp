import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { CheckboxRow } from '@/shared/ui/checkbox-row.view'
import { Chip } from '@/shared/ui/chip.view'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'

import {
  isApiError,
  useCompleteMyPreferences,
  useMe,
  useMyPreferences,
  useRoom,
  useSaveMyPreferences,
  useTaxonomies,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { InfoBanner } from '@/shared/ui/info-banner.view'
import { Atmosphere, PrimaryBtn } from '@/shared/ui/primitives'
import { taxonomyEmoji } from '@/features/create-date/taxonomy-emoji'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { styles } from './preference.style'

const MIN_PREFS = 2
const MAX_PREFS = 3
/** Preferences are collected here for every room member, including the host. */
const TAXONOMY_KIND = 'mood'

export default function PreferenceScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const taxonomies = useTaxonomies({ kinds: TAXONOMY_KIND })
  const preferences = useMyPreferences(roomId)
  const room = useRoom(roomId)
  const savePreferences = useSaveMyPreferences(roomId)
  const completePreferences = useCompleteMyPreferences(roomId)

  /** Null until the user touches a checkbox; the saved draft shows through. */
  const [edited, setEdited] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const savedSelection = useMemo(
    () => preferences.data?.selections?.[TAXONOMY_KIND] ?? null,
    [preferences.data],
  )

  const selected = edited ?? savedSelection ?? []

  const options = useMemo(() => {
    const entries = taxonomies.data?.kinds?.[TAXONOMY_KIND] ?? []
    return entries.map(entry => ({
      key: entry.key ?? '',
      label: entry.labels?.[i18n.language] ?? entry.labels?.vi ?? entry.key ?? '',
      emoji: taxonomyEmoji(entry.key ?? ''),
    }))
  }, [taxonomies.data, i18n.language])

  // ADR-0022: the profile's saved interests are offered as a chip, only while
  // nothing is chosen here and nothing was ever saved for this room, and they
  // fill the local draft only — autosave runs when the person continues, as it
  // always did. A guest has no profile and never sees the chip.
  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' })
  const savedInterests = useMemo(
    () => (me.data?.interests?.mood ?? []).filter(key => options.some(option => option.key === key)),
    [me.data, options],
  )
  const offerSaved =
    edited === null &&
    selected.length === 0 &&
    (preferences.data?.version ?? 0) === 0 &&
    savedInterests.length > 0

  function useSavedInterests() {
    setEdited(savedInterests.slice(0, MAX_PREFS))
    track('profile_prefill_used', { field: 'interests' })
  }

  function toggle(key: string) {
    setEdited(prev => {
      const current = prev ?? selected
      if (current.includes(key)) return current.filter(x => x !== key)
      return current.length < MAX_PREFS ? [...current, key] : current
    })
  }

  async function complete() {
    if (selected.length < MIN_PREFS || selected.length > MAX_PREFS) return
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
        <View>
          <AppHeader title={t('preference.headerTitle')} onBack={() => router.back()} />
        </View>
        <LoadingState />
      </Atmosphere>
    )
  }

  if (taxonomies.isError || preferences.isError) {
    return (
      <Atmosphere>
        <View>
          <AppHeader title={t('preference.headerTitle')} onBack={() => router.back()} />
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
  const couplePrivacy = room.data?.type === 'couple' &&
    room.data.decisionMode === 'match' && room.data.participantCount <= 2

  return (
    <Atmosphere>
      <BlockingLoadingOverlay visible={pending} />
      <View>
        <AppHeader title={t('preference.headerTitle')} onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Chip variant="positive" label={t('preference.selectedCount', { n: selected.length, max: MAX_PREFS })} />
        <Text variant="display" style={styles.title}>{t('preference.title')}</Text>
        <Text color="text.secondary" style={styles.body}>{t('preference.body')}</Text>
        <View style={styles.privacyNote}>
          <InfoBanner body={t(couplePrivacy ? 'gogoRoom.body' : 'gogoRoom.body_group')} />
        </View>

        {offerSaved ? (
          <Pressable
            onPress={useSavedInterests}
            accessibilityRole="button"
            accessibilityLabel={t('preference.useSaved')}
            style={styles.prefillRow}
          >
            <View style={styles.prefillIcon}>
              <Icon name="bookmark" size={20} color="accent.onSoft" />
            </View>
            <Text variant="title2" style={styles.prefillLabel}>{t('preference.useSaved')}</Text>
            <Icon name="zap" size={20} color="accent.primary" />
          </Pressable>
        ) : null}

        <View style={styles.choices}>
          {options.map(option => {
            const active = selected.includes(option.key)
            return (
              <CheckboxRow
                key={option.key}
                label={option.label}
                checked={active}
                disabled={!active && selected.length >= MAX_PREFS}
                accessibilityHint={!active && selected.length >= MAX_PREFS ? t('placeWizard.selectionLimitHint', { max: MAX_PREFS }) : undefined}
                leading={option.emoji ? <Text accessible={false}>{option.emoji}</Text> : undefined}
                onPress={() => toggle(option.key)}
              />
            )
          })}
          {selected.length >= MAX_PREFS ? (
            <Text variant="caption" color="text.secondary" accessibilityLiveRegion="polite">
              {t('placeWizard.selectionLimitHint', { max: MAX_PREFS })}
            </Text>
          ) : null}
        </View>

        {error ? (
          <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <GlassBar placement="docked">
        <PrimaryBtn
          label={`${t('common.continue')}${selected.length > 0 ? ` (${selected.length})` : ''}`}
          onPress={complete}
          icon="arrowRight"
          loading={pending}
          disabled={selected.length < MIN_PREFS || selected.length > MAX_PREFS}
        />
      </GlassBar>
    </Atmosphere>
  )
}
