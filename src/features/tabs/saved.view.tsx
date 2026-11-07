import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Share, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppAreaStore } from '@/shared/location/app-area'
import { discoveryLabels, isApiError, useTaxonomies, useSavedEntries, useToggleSaved, type SavedEntry } from '@/shared/api'
import { useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, Chip, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { PlaceCardSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { groupSavedByArea, type CurrentArea } from './saved-groups'
import { SavedPlanCard } from './saved-plan-card.view'
import { styles } from './saved.style'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { MapCanvas } from '@/shared/ui/map-canvas.view'
import { createShareLink } from '@/shared/api/endpoints/share-links'
import { savedDistance, savedGroupPins, savedUnavailable } from './saved-facts'
import { SavedLink } from './saved-link.view'

type SavedFilter = 'all' | 'places' | 'plans'

const FILTERS: readonly SavedFilter[] = ['all', 'places', 'plans']

/**
 * ADM-205 (#214) — Saved places and plans, grouped by province and commune.
 * Area maps use the same saved place facts as the list.
 */
export default function SavedScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('saved')

  const canSave = status === 'user'
  const saved = useSavedEntries({ enabled: canSave })
  const toggleSaved = useToggleSaved()
  const [feedback, setFeedback] = useState('')
  const [menu, setMenu] = useState<SavedEntry | null>(null)
  const [mapKeys, setMapKeys] = useState<string[] | null>(null)
  const [resultError, setResultError] = useState(false)
  const [sharing, setSharing] = useState(false)
  const pendingMenuAction = useRef<{ entry: SavedEntry; kind: 'share' | 'remove' } | null>(null)
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 3500); return () => clearTimeout(timer) }, [feedback])
  const taxonomy = useTaxonomies()
  const labels = useMemo(() => discoveryLabels(taxonomy.data, i18n.language), [taxonomy.data, i18n.language])
  const [filter, setFilter] = useState<SavedFilter>('all')

  const { scope } = useDiscoveryScope()
  const area = useAppAreaStore(state => state.area)
  const current: CurrentArea = area ? { provinceCode: area.provinceCode, communeCode: area.communeCode } : null

  const visible = saved.entries.filter(
    entry => filter === 'all' || entry.type === (filter === 'places' ? 'place' : 'plan'),
  )
  const groups = groupSavedByArea(
    visible.map(entry => ({ key: entry.key, area: entry.area, value: entry })),
    current,
  )

  const mapEntries = (canSave ? saved.entries : []).filter(entry => mapKeys?.includes(entry.key))
  const pins = savedGroupPins(mapEntries)
  function openGroup(entries: SavedEntry[]) {
    setMapKeys(entries.filter(entry => entry.type === 'place').map(entry => entry.key))
  }
  function unsave(entry: SavedEntry) {
    if (!canSave || toggleSaved.isPending) return
    toggleSaved.mutate({ type: entry.type, id: entry.id, saved: true }, {
      onSuccess: () => setFeedback(t('saved.feedback.removed')),
      onError: () => setResultError(true),
    })
  }
  async function share(entry: SavedEntry) {
    if (!canSave || sharing) return
    setSharing(true)
    try {
      const link = await createShareLink({ type: entry.type === 'place' ? 'PLACE' : 'PLAN', entityId: entry.id, source: 'saved' })
      await Share.share({ message: link.url, url: link.url })
    } catch { setResultError(true) }
    finally { setSharing(false) }
  }

  function renderEntry(entry: SavedEntry) {
    if (entry.detailError && !(isApiError(entry.detailError) && [403, 404, 410].includes(entry.detailError.status))) {
      return <ErrorState key={entry.key} error={entry.detailError} onRetry={() => void saved.refetch()} />
    }
    if (entry.type === 'plan') {
      return (
        <SavedPlanCard
          key={entry.key}
          plan={entry.plan}
          conditionsChanged={entry.conditionsChanged}
          onGo={() => router.push(`/plans/${entry.id}/active`)}
          onOpen={() => router.push(`/plans/${entry.id}`)}
          onRemove={() => unsave(entry)}
        />
      )
    }
    if (!entry.place) {
      return (
        <Card padded={false} key={entry.key} style={styles.unavailable}>
          <View style={styles.unavailableRow}>
            <Icon name="alert" size={16} color="status.warningText" />
            <Text variant="bodySmall" color="text.secondary" style={styles.unavailableText}>{t('saved.placeUnavailable')}</Text>
          </View>
          <GhostBtn label={t('saved.remove')} onPress={() => unsave(entry)} />
        </Card>
      )
    }
    const reason = savedUnavailable(entry.place)
    const tagLabels = [...new Set(entry.place.taxonomies?.flatMap(tag => tag.kind && tag.key && labels[tag.kind]?.[tag.key] ? [labels[tag.kind]![tag.key]!] : []) ?? [])]
    const categories = entry.place.taxonomies?.filter(tag => tag.kind === 'category').map(tag => tag.key) ?? []
    const canFindSimilar = categories.length > 0 && !!entry.area.provinceCode && !!entry.area.datasetVersion
    return (
      <PlaceCard
        key={entry.key}
        place={{ ...entry.place, distanceM: savedDistance(entry.place, scope.status === 'ready' && scope.source === 'gps' ? scope.position : null), discovery: { ...entry.place.discovery, tagLabels } }}
        appearance="saved"
        photoCategoryLabel={entry.place.taxonomies?.filter(tag => tag.kind === 'category').flatMap(tag => tag.key && labels.category?.[tag.key] ? [labels.category[tag.key]!] : []).join(' · ') || undefined}
        unavailableLabel={reason ? t(`saved.unavailable.${reason}`) : undefined}
        headerAction={<IconBtn accessibilityLabel={t('saved.actions')} style={styles.cardMenu} onPress={() => setMenu(entry)}><Text>⋮</Text></IconBtn>}
        footer={reason ? <>
          <GhostBtn label={t('saved.remove')} onPress={() => unsave(entry)} />
          {canFindSimilar ? <GhostBtn label={t('saved.similar')} onPress={() => {
            router.push({ pathname: '/places/search', params: { categories: categories.join(','), suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'selected_area', area: { datasetVersion: entry.area.datasetVersion, provinceCode: entry.area.provinceCode, provinceName: entry.area.provinceName, communeCode: entry.area.communeCode, communeName: entry.area.communeName } }) } })
          }} /> : null}
        </> : undefined}
        onPress={() => router.push(`/places/${entry.id}`)}
        saved
        onToggleSave={() => unsave(entry)}
        style={styles.placeItem}
      />
    )
  }

  return (
    <Atmosphere>
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.headerRow}>
          <Text variant="title1" color="redesign.primaryText">GoGo · {t('saved.title')}</Text>
          <HeaderNotificationButton testID="saved-bell" unreadDotTestID="saved-unread" />
        </View>
        {canSave ? <SavedLink onFeedback={setFeedback} /> : null}
        {canSave && feedback ? <Text accessibilityLiveRegion="polite" testID="saved-feedback" variant="bodySmall" color="status.successText">{feedback}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(option => (
            <Chip
              key={option}
              label={`${filter === option ? '✓ ' : ''}${t(`saved.filter.${option}`)}${canSave ? ` (${saved.entries.filter(entry => option === 'all' || entry.type === (option === 'places' ? 'place' : 'plan')).length})` : ''}`}
              variant={filter === option ? 'selected' : 'default'}
              onPress={() => setFilter(option)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Saving requires an account: a guest token gets 403 USER_ONLY. */}
      {!canSave ? (
        <EmptyState
          title={t('saved.signInTitle')}
          body={t('saved.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in?next=saved')} />}
        />
      ) : saved.isPaused ? <OfflineState /> : saved.isPending ? (
        <View style={[styles.grid, styles.list]}>
          {[0, 1, 2, 3].map(index => (
            <View key={index} style={styles.placeItem}>
              <PlaceCardSkeleton />
            </View>
          ))}
        </View>
      ) : saved.isError ? (
        <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('saved.emptyTitle')}
          body={t('saved.emptyBody')}
          action={<GhostBtn label={t('saved.browse')} onPress={() => router.push('/places/search')} />}
        />
      ) : (
        <ScrollView
          testID="saved-list"
        onScroll={fab.onScroll}
          scrollEventThrottle={fab.scrollEventThrottle}
          contentContainerStyle={[styles.list, { paddingBottom: fab.bottomInset }]}
        >
          {groups.map(group => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupDot} />
                <Text variant="title2" accessibilityRole="header">
                  {group.kind === 'province'
                    ? group.provinceName
                    : t(group.kind === 'unknown' ? 'saved.group.unknown' : 'saved.group.multipleProvinces')}
                </Text>
                <Text variant="caption" color="text.secondary">({group.kind === 'province' ? group.communes.reduce((count, commune) => count + commune.entries.length, 0) : group.entries.length})</Text>
                <GhostBtn label={t('saved.viewGroup')} disabled={!(group.kind === 'province' ? group.communes.flatMap(commune => commune.entries) : group.entries).some(item => item.value.type === 'place' && !!item.value.place)} onPress={() => openGroup((group.kind === 'province' ? group.communes.flatMap(commune => commune.entries) : group.entries).map(item => item.value))} />
                {group.kind === 'province' && group.isCurrent ? (
                  <Chip label={t('saved.currentArea')} variant="info" />
                ) : null}
              </View>
              {group.kind === 'province' ? (
                group.communes.map(commune => (
                  <View key={commune.key} style={styles.subgroup}>
                    <View style={styles.groupHeader}>
                      <Text variant="label" accessibilityRole="header">
                        {commune.kind === 'commune' ? commune.communeName : t('saved.group.multipleCommunes')}
                      </Text>
                      <Text variant="caption" color="text.secondary">({commune.entries.length})</Text>
                      {commune.isCurrent ? <Chip label={t('saved.currentArea')} variant="info" /> : null}
                    </View>
                    <View style={styles.grid}>{commune.entries.map(item => renderEntry(item.value))}</View>
                  </View>
                ))
              ) : (
                <View style={styles.grid}>{group.entries.map(item => renderEntry(item.value))}</View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      <Sheet visible={canSave && mapKeys !== null} onClose={() => setMapKeys(null)} size="full" testID="saved-group-map" header={<Text variant="title2">{t('saved.viewGroup')}</Text>}>
        <View style={styles.map}><MapCanvas pins={pins} onSelect={id => { setMapKeys(null); router.push(`/places/${id}`) }} fallback={<Text>{t('saved.mapFallback')}</Text>} /></View>
        {mapEntries.filter(entry => entry.place).map(entry => <GhostBtn key={entry.key} label={entry.place!.name} onPress={() => { setMapKeys(null); router.push(`/places/${entry.id}`) }} />)}
      </Sheet>
      <Sheet visible={canSave && menu !== null} onClose={() => setMenu(null)} onClosed={() => { const action = pendingMenuAction.current; pendingMenuAction.current = null; if (action?.kind === 'share') void share(action.entry); else if (action) unsave(action.entry) }} testID="saved-actions">
        <GhostBtn label={t('saved.remove')} disabled={toggleSaved.isPending} onPress={() => { if (menu) pendingMenuAction.current = { entry: menu, kind: 'remove' }; setMenu(null) }} />
        <GhostBtn label={t('saved.share')} disabled={sharing} onPress={() => { if (menu) pendingMenuAction.current = { entry: menu, kind: 'share' }; setMenu(null) }} />
      </Sheet>
      <ResultSheet visible={resultError} variant="error" title={t('saved.actionFailed')} body={t('saved.retryBody')}
        primaryAction={{ label: t('common.close'), onPress: () => setResultError(false) }} onClose={() => setResultError(false)} />
    </Atmosphere>
  )
}
