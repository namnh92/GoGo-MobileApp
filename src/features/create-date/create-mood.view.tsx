import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { isApiError, useCreateRoom, useTaxonomies } from '@/shared/api'
import { newIdempotencyKey } from '@/shared/api/idempotency'
import { clearSavedRoomDraft, saveRoomDraft } from '@/shared/store/savedRoomDraft'
import { noteAssistantPlanCreated } from '@/shared/store/assistantIntroStore'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { toCreateRoomBody, useRoom, useRoomStore } from '@/shared/store/roomStore'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Atmosphere, Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { CheckboxRow } from '@/shared/ui/checkbox-row.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { WizardStep } from './wizard-step.view'
import { styles } from './create-mood.style'

const MAX_MOODS = 3
const MAX_SETTINGS = 2

/** Kinds this screen collects, requested in one call. */
const TAXONOMY_KINDS = 'mood,setting,spending_style'

interface ChipOption {
  key: string
  label: string
}

function ChoiceList({ options, selected, onToggle, max }: {
  options: ChipOption[]
  selected: string[]
  onToggle: (key: string) => void
  max?: number
}) {
  const { t } = useTranslation()
  const atLimit = max !== undefined && selected.length >= max
  return (
    <View style={styles.choices}>
      {options.map(option => (
        <CheckboxRow
          key={option.key}
          label={option.label}
          checked={selected.includes(option.key)}
          disabled={atLimit && !selected.includes(option.key)}
          accessibilityHint={atLimit && !selected.includes(option.key) ? t('placeWizard.selectionLimitHint', { max }) : undefined}
          onPress={() => onToggle(option.key)}
        />
      ))}
      {atLimit ? <Text variant="caption" color="text.secondary" accessibilityLiveRegion="polite">{t('placeWizard.selectionLimitHint', { max })}</Text> : null}
    </View>
  )
}

export default function CreateMoodScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
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
      // A created plan makes the GoGo AI introduction due on Home (#379).
      if (session?.userId) noteAssistantPlanCreated(session.userId)
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
    <Atmosphere redesign>
      <BlockingLoadingOverlay visible={createRoom.isPending} />
      <WizardStep step="mood" onBack={() => router.back()} />

      {taxonomies.isPaused && !taxonomies.data ? (
        <View testID="create-mood-offline" style={[styles.errorWrap, { paddingBottom: footerInset + spacing[4] }]}><OfflineState /></View>
      ) : taxonomies.isPending ? (
        // Match the checkbox rows that follow.
        <View testID="create-mood-pending" style={[styles.pending, { paddingBottom: footerInset + spacing[4] }]}>
          <Skeleton width="55%" height={22} />
          <View style={styles.choices}>
            {[0, 1, 2, 3, 4, 5].map(index => (
              <Skeleton key={index} width="100%" height={44} />
            ))}
          </View>
          <Skeleton width="40%" height={18} />
          <View style={styles.choices}>
            {[0, 1, 2, 3].map(index => (
              <Skeleton key={index} width="100%" height={44} />
            ))}
          </View>
        </View>
      ) : taxonomies.isError ? (
        // The floating footer covers these branches too; pad them like the list.
        <View testID="create-mood-error" style={[styles.errorWrap, { paddingBottom: footerInset + spacing[4] }]}>
          <ErrorState error={taxonomies.error} onRetry={() => void taxonomies.refetch()} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: footerInset + spacing[4] }}>
          <Text variant="discoveryTitle">{t('createMood.title')}</Text>
          <Text color="text.secondary" style={styles.body}>{t('createMood.body', { max: MAX_MOODS })}</Text>

          {toOptions('mood').length + toOptions('setting').length + toOptions('spending_style').length === 0 ? <View testID="create-mood-empty"><EmptyState title={t('createMood.emptyTitle')} body={t('createMood.emptyBody')} /></View> : null}
          {toOptions('mood').length ? <Text variant="discoveryHeading" style={styles.moodTitle}>{t('createMood.moodTitle')}</Text> : null}
          <ChoiceList options={toOptions('mood')} selected={moods} max={MAX_MOODS} onToggle={toggleCapped(setMoods, MAX_MOODS)} />

          {toOptions('setting').length ? <Text variant="discoveryHeading" style={styles.sectionTitle}>{t('createMood.settingTitle')}</Text> : null}
          <ChoiceList options={toOptions('setting')} selected={settings} max={MAX_SETTINGS} onToggle={toggleCapped(setSettings, MAX_SETTINGS)} />

          {toOptions('spending_style').length ? <Text variant="discoveryHeading" style={styles.sectionTitle}>{t('createMood.spendingTitle')}</Text> : null}
          <ChoiceList
            options={toOptions('spending_style')}
            selected={spending ? [spending] : []}
            onToggle={key => setSpending(current => (current === key ? null : key))}
          />

          <Text variant="discoveryHeading" style={styles.sectionTitle}>{t('createMood.seedTitle')}</Text>
          <Text variant="bodySmall" color="text.secondary" style={styles.seedHint}>{t('createMood.seedHint')}</Text>
          <View style={styles.seedRow}>
            {seedPlaces.map(place => (
              <Chip
                key={place.placeId}
                label={place.name}
                icon="mapPin"
                variant="info"
                accessibilityLabel={t('createMood.removePlace', { name: place.name })}
                onRemove={() => removeSeedPlace(place.placeId)}
                removeAccessibilityLabel={t('createMood.removePlace', { name: place.name })}
              />
            ))}
            <Chip label={t('createMood.addPlace')} onPress={() => router.push('/places/search?picker=1')} />
          </View>

          {error ? (
            <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <GlassBar placement="floating" testID="create-footer" onHeightChange={setFooterHeight}>
        <PrimaryBtn
          variant="stitch"
          label={createRoom.isPending ? t('createMood.creating') : t('createMood.cta')}
          onPress={submit}
          icon="arrowRight"
          loading={createRoom.isPending}
          disabled={taxonomies.isPending || taxonomies.isError}
        />
      </GlassBar>
    </Atmosphere>
  )
}
