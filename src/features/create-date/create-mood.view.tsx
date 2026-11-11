import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { detailToPlaceCard, isApiError, useCreateRoom, usePlaceDetail, useTaxonomies } from '@/shared/api'
import { newIdempotencyKey } from '@/shared/api/idempotency'
import { clearSavedRoomDraft, saveRoomDraft } from '@/shared/store/savedRoomDraft'
import { noteAssistantPlanCreated } from '@/shared/store/assistantIntroStore'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { toCreateRoomBody, useRoom, useRoomStore } from '@/shared/store/roomStore'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { CheckboxRow } from '@/shared/ui/checkbox-row.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { clearPickerScope, draftPickerScope, savePickerScope } from '@/shared/location/picker-scope'
import { ExpandToggle } from '@/shared/ui/expand-toggle.view'
import { PlaceCardSmall } from '@/shared/ui/place-card-small.view'
import type { SeedPlaceRef } from '@/shared/store/roomStore'

import { WizardScreen } from './wizard-step.view'
import { styles } from './create-mood.style'

const MAX_MOODS = 3
const MAX_SETTINGS = 2

/** Kinds this screen collects, requested in one call. */
const TAXONOMY_KINDS = 'mood,setting,spending_style'

interface ChipOption {
  key: string
  label: string
}

function collapsedVisible(options: ChipOption[], selected: Set<string>): ChipOption[] {
  const base = options.slice(0, 5)
  const overflowSelected = options.slice(5).filter(option => selected.has(option.key))
  if (overflowSelected.length === 0) return base

  const replaceable = new Set(base.filter(option => !selected.has(option.key))
    .slice(-overflowSelected.length).map(option => option.key))
  // Both slices retain their original order; overflow follows every base option.
  return [...base.filter(option => !replaceable.has(option.key)), ...overflowSelected]
}

function ChoiceList({ title, options, selected, onToggle, max }: {
  title: string
  options: ChipOption[]
  selected: string[]
  onToggle: (key: string) => void
  max?: number
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? options : collapsedVisible(options, new Set(selected))
  const atLimit = max !== undefined && selected.length >= max
  return (
    <View>
      {options.length ? <View style={styles.sectionHeader}>
        <Text variant="discoveryHeading">{title}</Text>
      </View> : null}
      <View style={styles.choices}>
        {visible.map(option => (
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
      {options.length > 5 ? <ExpandToggle expanded={expanded} accessibilityLabel={t(expanded ? 'createMood.showLess' : 'createMood.showAll')} onPress={() => setExpanded(value => !value)} /> : null}
    </View>
  )
}

/** Facts stay in the query cache; restored drafts need only their id/name refs. */
function SeedPlaceCard({ seed, onRemove }: { seed: SeedPlaceRef; onRemove: () => void }) {
  const { t } = useTranslation()
  const detail = usePlaceDetail(seed.placeId)
  const place = detailToPlaceCard(detail.data ?? { id: seed.placeId, name: seed.name })
  return <PlaceCardSmall place={place} onRemove={onRemove} removeAccessibilityLabel={t('createMood.removePlace', { name: place.name })} />
}

export default function CreateMoodScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [footerHeight, setFooterHeight] = useState(0)
  const footerInset = useBottomBarInset(footerHeight)
  const { status, session } = useSession()
  const { seedPlaces, removeSeedPlace } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const administrativeArea = useRoomStore(state => state.administrativeArea)
  const originLat = useRoomStore(state => state.originLat)
  const originLng = useRoomStore(state => state.originLng)
  const radiusM = useRoomStore(state => state.radiusM)
  const pickerScope = draftPickerScope({ administrativeArea, originLat, originLng, radiusM })
  const pickerScopeId = useRef<string | null>(null)
  const pickerOpening = useRef(false)
  const [isPickerOpening, setIsPickerOpening] = useState(false)
  useFocusEffect(useCallback(() => {
    pickerOpening.current = false
    setIsPickerOpening(false)
  }, []))
  useEffect(() => () => clearPickerScope(pickerScopeId.current), [])
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
    <WizardScreen step="mood" onBack={() => router.back()}>
      <BlockingLoadingOverlay visible={createRoom.isPending} />

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
        <ScrollView testID="create-mood-scroll" style={styles.scroll} contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: footerInset + spacing[4] }}>
          <Text variant="discoveryTitle">{t('createMood.title')}</Text>
          <Text color="text.secondary" style={styles.body}>{t('createMood.body', { max: MAX_MOODS })}</Text>

          {toOptions('mood').length + toOptions('setting').length + toOptions('spending_style').length === 0 ? <View testID="create-mood-empty"><EmptyState title={t('createMood.emptyTitle')} body={t('createMood.emptyBody')} /></View> : null}
          <ChoiceList title={t('createMood.moodTitle')} options={toOptions('mood')} selected={moods} max={MAX_MOODS} onToggle={toggleCapped(setMoods, MAX_MOODS)} />

          <ChoiceList title={t('createMood.settingTitle')} options={toOptions('setting')} selected={settings} max={MAX_SETTINGS} onToggle={toggleCapped(setSettings, MAX_SETTINGS)} />

          <ChoiceList title={t('createMood.spendingTitle')}
            options={toOptions('spending_style')}
            selected={spending ? [spending] : []}
            onToggle={key => setSpending(current => (current === key ? null : key))}
          />

          <Text variant="discoveryHeading" style={styles.sectionTitle}>{t('createMood.seedTitle')}</Text>
          <Text variant="bodySmall" color="text.secondary" style={styles.seedHint}>{t('createMood.seedHint')}</Text>
          <View testID="create-mood-seed-list" style={styles.seedList}>
            {seedPlaces.map(place => <SeedPlaceCard key={place.placeId} seed={place} onRemove={() => removeSeedPlace(place.placeId)} />)}
          </View>
          <View style={styles.addPlace}>
            <Chip label={t('createMood.addPlace')} variant={pickerScope ? 'default' : 'disabled'} disabled={isPickerOpening} onPress={() => {
              if (pickerScope && !pickerOpening.current) {
                pickerOpening.current = true
                setIsPickerOpening(true)
                pickerScopeId.current = savePickerScope(pickerScope)
                router.push({ pathname: '/places/search', params: { picker: '1', pickerScope: pickerScopeId.current } })
              }
            }} />
          </View>
          {!pickerScope ? <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">
            {t(!administrativeArea && originLat != null && originLng != null && radiusM === null
              ? 'createMood.seedRadiusUnsupported' : 'createMood.seedScopeUnavailable')}
          </Text> : null}

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
    </WizardScreen>
  )
}
