import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, useCreateRoom, useTaxonomies } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { toCreateRoomBody, useRoom, useRoomStore } from '@/shared/store/roomStore'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './create-mood.style'
import { taxonomyEmoji } from './taxonomy-emoji'

const MAX_MOODS = 3
const MAX_SETTINGS = 2

/** Kinds this screen collects, requested in one call. */
const TAXONOMY_KINDS = 'mood,setting,spending_style'

interface ChipOption {
  key: string
  label: string
  emoji?: string
}

function ChipGrid({ options, selected, onToggle, cols = 2 }: {
  options: ChipOption[]
  selected: string[]
  onToggle: (key: string) => void
  cols?: number
}) {
  // cols=3 rows (short labels) auto-size so text never truncates.
  const sizing = cols === 3 ? styles.chipAuto : { width: '48%' as const }
  return (
    <View style={styles.grid}>
      {options.map(option => {
        const active = selected.includes(option.key)
        return (
          <Pressable
            key={option.key}
            onPress={() => onToggle(option.key)}
            accessibilityState={{ selected: active }}
            style={[styles.chip, sizing, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
          >
            {option.emoji ? <Text style={{ fontSize: 20 }}>{option.emoji}</Text> : null}
            <Text style={[styles.chipLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function CreateMoodScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  const { seedPlaces, removeSeedPlace } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const rememberRoom = useRecentRoomsStore(state => state.remember)

  const taxonomies = useTaxonomies({ kinds: TAXONOMY_KINDS })
  const createRoom = useCreateRoom()

  const [moods, setMoods] = useState<string[]>([])
  const [settings, setSettings] = useState<string[]>([])
  const [spending, setSpending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const locale = i18n.language

  /** Taxonomy entries carry `labels[locale]`; vi is the fallback source locale. */
  function toOptions(kind: string): ChipOption[] {
    const entries = taxonomies.data?.kinds?.[kind] ?? []
    return entries.map(entry => ({
      key: entry.key ?? '',
      label: entry.labels?.[locale] ?? entry.labels?.vi ?? entry.key ?? '',
      emoji: taxonomyEmoji(entry.key ?? ''),
    }))
  }

  function toggleCapped(setter: React.Dispatch<React.SetStateAction<string[]>>, max: number) {
    return (key: string) =>
      setter(prev => (prev.includes(key) ? prev.filter(x => x !== key) : prev.length < max ? [...prev, key] : prev))
  }

  async function submit() {
    // Only an account can own a room — a guest session gets 403 USER_ONLY.
    if (status !== 'user') {
      router.push('/auth/sign-in?next=create')
      return
    }

    setError(null)
    // Carried into the first preference save so the picks are not lost.
    patchDraft({ moodKeys: moods, settingKeys: settings, spendingStyleKey: spending })

    try {
      const room = await createRoom.mutateAsync(toCreateRoomBody(useRoomStore.getState()))
      rememberRoom(room)
      track('date_context_completed', {
        moods: moods.join(','),
        settings: settings.join(','),
        spending: spending ?? '',
      })
      track('gogo_room_created', { roomType: room.type, decisionMode: room.decisionMode })
      router.replace(`/room/${room.id}`)
    } catch (caught) {
      setError(
        isApiError(caught) && caught.fieldErrors.length > 0
          ? caught.fieldErrors[0].message
          : t('createMood.createFailed'),
      )
    }
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>4 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={3} />
      </View>

      {taxonomies.isPending ? (
        <LoadingState />
      ) : taxonomies.isError ? (
        <ErrorState error={taxonomies.error} onRetry={() => void taxonomies.refetch()} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
          <Text style={styles.title}>{t('createMood.title')}</Text>
          <Text style={styles.body}>{t('createMood.body', { max: MAX_MOODS })}</Text>

          <ChipGrid options={toOptions('mood')} selected={moods} onToggle={toggleCapped(setMoods, MAX_MOODS)} />

          <Text style={styles.sectionTitle}>{t('createMood.settingTitle')}</Text>
          <ChipGrid options={toOptions('setting')} selected={settings} onToggle={toggleCapped(setSettings, MAX_SETTINGS)} />

          <Text style={styles.sectionTitle}>{t('createMood.spendingTitle')}</Text>
          <ChipGrid
            options={toOptions('spending_style')}
            selected={spending ? [spending] : []}
            onToggle={key => setSpending(current => (current === key ? null : key))}
          />

          <Text style={styles.sectionTitle}>{t('createMood.seedTitle')}</Text>
          <Text style={styles.seedHint}>{t('createMood.seedHint')}</Text>
          <View style={styles.seedRow}>
            {seedPlaces.map(place => (
              <Pressable
                key={place.title}
                onPress={() => removeSeedPlace(place.title)}
                accessibilityLabel={`${place.title} ✕`}
                style={styles.seedChip}
              >
                <Text style={styles.seedChipLabel}>{place.category} {place.title}  ✕</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/places/search?picker=1')} style={styles.seedAddBtn}>
              <Text style={styles.seedAddLabel}>{t('createMood.addPlace')}</Text>
            </Pressable>
          </View>

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn
          label={createRoom.isPending ? t('createMood.creating') : t('createMood.cta')}
          onPress={submit}
          loading={createRoom.isPending}
          disabled={taxonomies.isPending}
        />
      </View>
    </Atmosphere>
  )
}
