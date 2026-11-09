import { AppHeader } from '@/shared/ui/app-header.view'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppAreaStore } from '@/shared/location/app-area'
import { discoveryLabels, isApiError, useTaxonomies, useSavedEntries, useToggleSaved, type SavedEntry } from '@/shared/api'
import { useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { PlaceCardLarge } from '@/shared/ui/place-card-large.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, GhostBtn } from '@/shared/ui/primitives'
import { PlaceCardSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { TAB_BAR_HEIGHT } from '@/shared/ui/bottom-bar-inset'
import { styles as cityStyles } from './saved-city.style'
import { spacing } from '@/shared/ui/tokens'

import { groupSavedByArea, type CurrentArea } from './saved-groups'
import { styles } from './saved.style'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { savedDistance, savedUnavailable } from './saved-facts'
import { SavedLink } from './saved-link.view'

/** One Saved renderer for the city overview and the pushed ward list. */
export function SavedPlacesScreen({ city, renderHeader, renderBottomBar }: {
  city?: { provinceCode: string; name: string }
  renderHeader?: (title: string, count: number | undefined) => ReactNode
  renderBottomBar?: () => ReactNode
}) {
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
  const [resultError, setResultError] = useState(false)
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 3500); return () => clearTimeout(timer) }, [feedback])
  const taxonomy = useTaxonomies()
  const labels = useMemo(() => discoveryLabels(taxonomy.data, i18n.language), [taxonomy.data, i18n.language])

  const { scope } = useDiscoveryScope()
  const area = useAppAreaStore(state => state.area)
  const current: CurrentArea = area ? { provinceCode: area.provinceCode, communeCode: area.communeCode } : null

  const visible = saved.entries.filter(entry => entry.type === 'place')
  const groups = groupSavedByArea(
    visible.map(entry => ({ key: entry.key, area: entry.area, value: entry })),
    current,
  )

  const visibleGroups = city ? groups.filter(group => group.kind === 'province' && group.provinceCode === city.provinceCode) : groups
  const selectedCity = visibleGroups.find(group => group.kind === 'province')
  const cityTitle = selectedCity?.kind === 'province' ? selectedCity.provinceName : city?.name || t('saved.title')
  function similarParams(entry: SavedEntry) {
    const categories = entry.place?.taxonomies?.filter(tag => tag.kind === 'category').map(tag => tag.key).filter(Boolean) ?? []
    if (!categories.length || !entry.area.provinceCode || !entry.area.datasetVersion) return null
    return { categories: categories.join(','), suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'selected_area', area: { datasetVersion: entry.area.datasetVersion, provinceCode: entry.area.provinceCode, provinceName: entry.area.provinceName, communeCode: entry.area.communeCode, communeName: entry.area.communeName } }) }
  }
  function findSimilar(entry: SavedEntry) {
    const params = similarParams(entry)
    if (params) router.push({ pathname: '/places/search', params })
  }
  function unsave(entry: SavedEntry) {
    if (!canSave || toggleSaved.isPending) return
    toggleSaved.mutate({ type: entry.type, id: entry.id, saved: true }, {
      onSuccess: () => setFeedback(t('saved.feedback.removed')),
      onError: () => setResultError(true),
    })
  }
  function renderEntry(entry: SavedEntry) {
    if (entry.detailError && !(isApiError(entry.detailError) && [403, 404, 410].includes(entry.detailError.status))) {
      return <ErrorState key={entry.key} error={entry.detailError} onRetry={() => void saved.refetch()} />
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
    const canFindSimilar = similarParams(entry) !== null
    return (
      <PlaceCardLarge
        key={entry.key}
        place={{ ...entry.place, distanceM: savedDistance(entry.place, scope.status === 'ready' && scope.source === 'gps' ? scope.position : null), discovery: { ...entry.place.discovery, tagLabels } }}
        categoryLabel={entry.place.taxonomies?.filter(tag => tag.kind === 'category').flatMap(tag => tag.key && labels.category?.[tag.key] ? [labels.category[tag.key]!] : []).join(' · ') || undefined}
        unavailableLabel={reason ? t(`saved.unavailable.${reason}`) : undefined}
        footer={reason && canFindSimilar ? <GhostBtn label={t('saved.similar')} onPress={() => findSimilar(entry)} /> : undefined}
        onPress={() => router.push(`/places/${entry.id}`)}
        saved
        onToggleSave={() => unsave(entry)}
        style={styles.placeItem}
      />
    )
  }

  return (
    <Atmosphere style={city ? cityStyles.canvas : undefined}>
      {renderHeader ? renderHeader(cityTitle, canSave && !saved.isPending && !saved.isError && !saved.isPaused ? (selectedCity?.kind === 'province' ? selectedCity.communes.reduce((n, ward) => n + ward.entries.length, 0) : 0) : undefined) : <>
        <AppHeader variant="tab-root" title={t('saved.title')} bellTestID="saved-bell" unreadDotTestID="saved-unread" />
        <View style={styles.saveLink}>
          {canSave ? <SavedLink onFeedback={setFeedback} /> : null}
          {canSave && feedback ? <Text accessibilityLiveRegion="polite" testID="saved-feedback" variant="bodySmall" color="status.successText">{feedback}</Text> : null}
        </View>
      </>}
      {city && canSave && feedback ? <Text accessibilityLiveRegion="polite" testID="saved-feedback" variant="bodySmall" color="status.successText" style={styles.feedback}>{feedback}</Text> : null}

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
        <PullToRefresh onRefresh={() => saved.refetch()}><ScrollView testID="saved-list"><ErrorState error={saved.error} onRetry={() => void saved.refetch()} /></ScrollView></PullToRefresh>
      ) : visibleGroups.length === 0 ? (
        <PullToRefresh onRefresh={() => saved.refetch()}><ScrollView testID="saved-list"><EmptyState
          title={t(city ? 'saved.cityEmptyTitle' : 'saved.emptyTitle')}
          body={city ? t('saved.cityEmptyBody', { city: cityTitle }) : t('saved.emptyBody')}
          action={<GhostBtn label={t('saved.browse')} onPress={() => router.push('/places/search')} />}
        /></ScrollView></PullToRefresh>
      ) : (
        <PullToRefresh onRefresh={() => saved.refetch()}><ScrollView
          testID="saved-list"
          onScroll={city ? undefined : fab.onScroll}
          scrollEventThrottle={fab.scrollEventThrottle}
          contentContainerStyle={[styles.list, city && cityStyles.list, { paddingBottom: city ? insets.bottom + TAB_BAR_HEIGHT + spacing[6] : fab.bottomInset }]}
        >
          {visibleGroups.map(group => (
            <View key={group.key} style={styles.group}>
              {!city ? <View style={styles.groupHeader}>
                <Text variant="title2" accessibilityRole="header" style={styles.groupTitle}>
                  {group.kind === 'province'
                    ? group.provinceName
                    : t(group.kind === 'unknown' ? 'saved.group.unknown' : 'saved.group.multipleProvinces')}
                </Text>
                <View style={styles.countBadge}><Text variant="caption" color="text.secondary">{group.kind === 'province' ? group.communes.reduce((count, commune) => count + commune.entries.length, 0) : group.entries.length}</Text></View>
                {group.kind === 'province' ? <GhostBtn label={t('saved.viewGroup')} accessibilityHint={t('saved.cityListHint', { city: group.provinceName })} size="small" style={styles.cityAction} onPress={() => router.push({ pathname: '/saved/city/[provinceCode]', params: { provinceCode: group.provinceCode, cityName: group.provinceName } })} /> : null}
              </View> : null}
              {group.kind === 'province' ? (
                group.communes.map((commune, index) => (
                  <View key={commune.key} style={city ? cityStyles.subgroup : [styles.subgroup, index === group.communes.length - 1 && styles.lastSubgroup]}>
                    <View style={city ? cityStyles.wardHeader : [styles.groupHeader, styles.wardHeader]}>
                      <Text variant={city ? "savedWardTitle" : "bodySmall"} color={city ? "text.primary" : "text.secondary"} accessibilityRole="header" style={styles.groupTitle}>
                        {commune.kind === 'commune' ? commune.communeName : t('saved.group.multipleCommunes')}
                      </Text>
                      <View style={city ? cityStyles.wardCount : styles.countBadge}><Text variant="caption" color="text.secondary">{commune.entries.length}</Text></View>
                    </View>
                    <View style={city ? cityStyles.cards : styles.grid}>{commune.entries.map(item => renderEntry(item.value))}</View>
                  </View>
                ))
              ) : (
                <View style={styles.grid}>{group.entries.map(item => renderEntry(item.value))}</View>
              )}
            </View>
          ))}
        </ScrollView></PullToRefresh>
      )}
      {renderBottomBar?.()}
      <ResultSheet visible={resultError} variant="error" title={t('saved.actionFailed')} body={t('saved.retryBody')}
        primaryAction={{ label: t('common.close'), onPress: () => setResultError(false) }} onClose={() => setResultError(false)} />
    </Atmosphere>
  )
}

export default function SavedScreen() {
  return <SavedPlacesScreen />
}
