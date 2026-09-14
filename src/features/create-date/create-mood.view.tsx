import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, useCreateRoom, useTaxonomies } from '@/shared/api'
import { newIdempotencyKey } from '@/shared/api/idempotency'
import { clearSavedRoomDraft, saveRoomDraft } from '@/shared/store/savedRoomDraft'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { toCreateRoomBody, useRoom, useRoomStore } from '@/shared/store/roomStore'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { ErrorState } from '@/shared/ui/async-state.view'
import { Atmosphere, Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { spacing } from '@/shared/ui/tokens'

import { WizardStep } from './wizard-step.view'
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

function ChipGrid({ options, selected, onToggle }: {
  options: ChipOption[]
  selected: string[]
  onToggle: (key: string) => void
}) {
  return (
    <View style={styles.grid}>
      {options.map(option => (
        <Chip
          key={option.key}
          label={option.label}
          icon={option.emoji}
          variant={selected.includes(option.key) ? 'selected' : 'default'}
          onPress={() => onToggle(option.key)}
        />
      ))}
    </View>
  )
}

export default function CreateMoodScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status, session } = useSession()
  const { seedPlaces, removeSeedPlace } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const rememberRoom = useRecentRoomsStore(state => state.remember)

  const taxonomies = useTaxonomies({ kinds: TAXONOMY_KINDS })
  const createRoom = useCreateRoom({ idempotencyKey: () => useRoomStore.getState().creationAttempt!.key })

  const moods = useRoomStore(state => state.moodKeys)
  const setMoods = (value: React.SetStateAction<string[]>) => patchDraft({ moodKeys: typeof value === 'function' ? value(moods) : value })
  const settings = useRoomStore(state => state.settingKeys)
  const setSettings = (value: React.SetStateAction<string[]>) => patchDraft({ settingKeys: typeof value === 'function' ? value(settings) : value })
  const spending = useRoomStore(state => state.spendingStyleKey)
  const setSpending = (value: React.SetStateAction<string | null>) => patchDraft({ spendingStyleKey: typeof value === 'function' ? value(spending) : value })
  const submitting = useRef(false)
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

    if (submitting.current) return
    submitting.current = true
    useRoomStore.setState({ creationPending: true })
    setError(null)
    // Carried into the first preference save so the picks are not lost.
    patchDraft({ moodKeys: moods, settingKeys: settings, spendingStyleKey: spending })

    try {
      const valid = moods.every(key => toOptions('mood').some(option => option.key === key))
        && settings.every(key => toOptions('setting').some(option => option.key === key))
        && (!spending || toOptions('spending_style').some(option => option.key === spending))
      if (!valid) { setError(t('draft.reviewSelections')); return }
      const body = toCreateRoomBody(useRoomStore.getState())
      const fingerprint = JSON.stringify(body)
      const attempt = useRoomStore.getState().creationAttempt
      if (attempt?.fingerprint !== fingerprint) {
        useRoomStore.setState({ creationAttempt: { key: newIdempotencyKey(), fingerprint } })
      }
      // Persist the request identity before sending, so a timeout or restart
      // retries the same room creation instead of publishing a second room.
      if (session?.userId) await saveRoomDraft(session.userId, 'mood')
      const room = await createRoom.mutateAsync(body)
      rememberRoom(room)
      // Keep only a room-scoped preference handoff; the create draft is done.
      useRoomStore.getState().finishDraft(room.id)
      await clearSavedRoomDraft().catch(() => undefined)
      track('date_context_completed', {
        moods: moods.join(','),
        settings: settings.join(','),
        spending: spending ?? '',
      })
      track('gogo_room_created', { roomType: room.type, decisionMode: room.decisionMode })
      router.replace(`/room/${room.id}`)
    } catch (caught) {
      setError(
        // ADM-020: the area was chosen from a dataset that has since been
        // replaced — say so, instead of a generic failure the retry cannot fix.
        isApiError(caught) && caught.code === 'ADMINISTRATIVE_VERSION_CHANGED'
          ? t('administrative.changed')
          : isApiError(caught) && caught.fieldErrors.length > 0
            ? caught.fieldErrors[0].message
            : t('createMood.createFailed'),
      )
    } finally { submitting.current = false; useRoomStore.setState({ creationPending: false }) }
  }

  return (
    <Atmosphere>
      <WizardStep step="mood" onBack={() => router.back()} />

      {taxonomies.isPending ? (
        // A grid of chips is coming; say so with its shape, not a spinner.
        <View style={{ paddingHorizontal: spacing[5], gap: spacing[3] }}>
          <Skeleton width="55%" height={22} />
          <View style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map(index => (
              <Skeleton key={index} width={index % 3 === 0 ? 120 : 96} height={32} radius={999} />
            ))}
          </View>
          <Skeleton width="40%" height={18} />
          <View style={styles.grid}>
            {[0, 1, 2, 3].map(index => (
              <Skeleton key={index} width={104} height={32} radius={999} />
            ))}
          </View>
        </View>
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
              <Chip
                key={place.placeId}
                label={`${place.name}  ✕`}
                icon="📍"
                variant="info"
                accessibilityLabel={t('createMood.removePlace', { name: place.name })}
                onPress={() => removeSeedPlace(place.placeId)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/places/search?picker=1')}
              style={styles.seedAddBtn}
            >
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
          disabled={taxonomies.isPending || taxonomies.isError}
        />
      </View>
    </Atmosphere>
  )
}
