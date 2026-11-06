import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Keyboard, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import {
  useAddRoomSeedPlaces, isSaved, toPlaceCard, useSaved, useTaxonomies, useToggleSaved, usePlaceSearch, useMe, useDiscoveryPreview, useContributionCredits, discoveryLabels,
  type PlaceCard as PlaceCardModel, type PlaceSearchQuery,
} from '@/shared/api'
import { assistantHref } from '@/features/assistant/assistant-entry'
import { isAssistantEntryOn } from '@/shared/config/features'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { scopeSearchParams, useDiscoveryScope, type DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Atmosphere, Chip, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { SearchField } from '@/shared/ui/search-field.view'
import { FieldFocusGroup } from '@/shared/ui/field-focus-group'
import { Sheet } from '@/shared/ui/sheet.view'
import { PlaceListSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { SegmentedControl } from '@/shared/ui/segmented-control.view'
import { MapCanvas } from '@/shared/ui/map-canvas.view'
import { useDiscoveryAreaStore } from './discovery-area-store'
import { SearchMapPanel } from './search-map-panel.view'
import { discoveryMap, viewportSearchScope } from './discovery-map'
import { styles } from './search.style'
import { DiscoveryLocationSheet } from './discovery-location.view'
import { SearchEmpty } from './search-empty.view'
import { emptyFilters, filterParams, validateFilters, type DiscoveryFilters } from './discovery-filters'

const SEARCH_DEBOUNCE_MS = 300

// The Home entry carries its resolved scope, rather than Search's previous area choice.
function readSuggestionScope(value: string | undefined): DiscoveryScope | null {
  if (!value) return null
  try {
    const scope = JSON.parse(value)
    if (scope?.status !== 'ready') return null
    if (scope.source === 'gps'
      && typeof scope.position?.lat === 'number' && Number.isFinite(scope.position.lat)
      && typeof scope.position?.lng === 'number' && Number.isFinite(scope.position.lng)) return scope
    if (['profile_area', 'selected_area', 'default_area'].includes(scope.source)
      && typeof scope.area?.datasetVersion === 'string' && typeof scope.area?.provinceCode === 'string'
      && typeof scope.area?.provinceName === 'string'
      && (scope.area.communeCode === null || typeof scope.area.communeCode === 'string')
      && (scope.area.communeName === null || typeof scope.area.communeName === 'string')) return scope
    if (scope.source === 'none' && ['no_area', 'area_needs_reselection'].includes(scope.reason)) return scope
  } catch { /* Invalid route data falls back to ordinary discovery. */ }
  return null
}

export default function SearchScreen() {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { picker, q, filters, roomId, moods, suggestions, suggestionScope } = useLocalSearchParams<{ picker?: string; q?: string; filters?: string; roomId?: string; moods?: string; suggestions?: string; suggestionScope?: string }>()
  const { status } = useSession()
  const isPicker = picker === '1'
  const canSave = status === 'user'
  const me = useMe({ enabled: status === 'user' || status === 'guest' })
  const selectedArea = useDiscoveryAreaStore(state => state.area)
  const { scope: resolvedScope, recheck, retry: retryScope } = useDiscoveryScope({ selectedArea, profileArea: status === 'user' ? me.data?.homeAdministrativeArea : null, profilePending: status === 'hydrating' || (status === 'user' && me.isPending) })
  const [scopeOverridden, setScopeOverridden] = useState(false)
  const [entryArea] = useState(selectedArea)
  const homeScope = useMemo(() => suggestions === '1' ? readSuggestionScope(suggestionScope) : null, [suggestions, suggestionScope])
  // A subsequent explicit area selection takes over from the Home entry scope.
  const scope = !isPicker && !scopeOverridden && homeScope && selectedArea === entryArea ? homeScope : resolvedScope
  const originLat = useRoomStore(state => state.originLat)
  const originLng = useRoomStore(state => state.originLng)
  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  const [query, setQuery] = useState(q ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(q ?? '')
  const [committed, setCommitted] = useState<DiscoveryFilters>(() => ({ ...emptyFilters(), moods: moods?.split(',').filter(Boolean) ?? [] }))
  const [draft, setDraft] = useState<DiscoveryFilters>(emptyFilters)
  const [sheetOpen, setSheetOpen] = useState(filters === '1')
  const [locationOpen, setLocationOpen] = useState(false)
  const [mode, setMode] = useState<'list' | 'map'>('list')
  const taxonomies = useTaxonomies({ kinds: 'category,mood,setting,amenity,suitability' })
  const labels = useMemo(() => discoveryLabels(taxonomies.data, i18n.language), [taxonomies.data, i18n.language])
  const credits = useContributionCredits(canSave)

  useEffect(() => { track('place_search_opened', { picker: isPicker }) }, [isPicker])
  useFocusEffect(useCallback(() => {
    void recheck()
    return () => { setTimeout(() => setSheetOpen(false), 0) }
  }, [recheck]))
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  const applied = useMemo(() => filterParams(committed), [committed])
  const activeFilterCount = Object.keys(applied).length
  const searchQuery: PlaceSearchQuery = useMemo(() => ({
    ...(!isPicker ? scopeSearchParams(scope) : originLat != null && originLng != null ? { lat: originLat, lng: originLng } : {}),
    locale: i18n.language.startsWith('en') ? 'en' : 'vi', includeTotal: true, ...(suggestions === '1' && !isPicker ? { limit: 10 } : {}),
    ...applied, ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }), [isPicker, scope, originLat, originLng, applied, debouncedQuery, i18n.language, suggestions])
  const baseKey = JSON.stringify(searchQuery)
  const [exploration, setExploration] = useState<{ key: string; region: NonNullable<ReturnType<typeof discoveryMap>['region']> } | null>(null)
  const viewport = mode === 'map' && exploration?.key === baseKey ? exploration.region : null
  const regionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (regionTimer.current) clearTimeout(regionTimer.current) }, [baseKey, mode])
  const [mapExpanded, setMapExpanded] = useState(false)
  const baseSearch = usePlaceSearch(searchQuery, { enabled: isPicker || scope.status === 'ready' })
  const viewportScope = viewport && viewportSearchScope(viewport)
  // Scope is transient: do not write the area store or send canonical area codes.
  const { datasetVersion: _dataset, provinceCode: _province, communeCode: _commune, ...positionQuery } = searchQuery
  const mapSearchQuery = viewportScope ? { ...positionQuery, ...viewportScope } : searchQuery
  const regionSearch = usePlaceSearch(mapSearchQuery, { enabled: !!viewportScope && (isPicker || scope.status === 'ready') })
  const search = viewportScope ? regionSearch : baseSearch
  function exploreRegion(region: NonNullable<ReturnType<typeof discoveryMap>['region']>) {
    if (!viewportSearchScope(region)) return
    if (regionTimer.current) clearTimeout(regionTimer.current)
    regionTimer.current = setTimeout(() => setExploration({ key: baseKey, region }), 400)
  }
  const { hasNextPage, isFetching, isFetchingNextPage, isPaused, isPlaceholderData, isFetchNextPageError, isError, fetchNextPage } = search
  // One request at a time, and never follow a cursor twice automatically.
  // A new query gets its own cursor budget; failed pages require an explicit retry.
  const mapCursorBudget = useRef({ key: '', cursors: new Set<string>() })
  const mapQueryKey = JSON.stringify(mapSearchQuery)
  const nextMapCursor = search.data?.pages.at(-1)?.nextCursor
  useEffect(() => {
    if (mapCursorBudget.current.key !== mapQueryKey) mapCursorBudget.current = { key: mapQueryKey, cursors: new Set() }
    if (mode !== 'map' || query.trim() !== debouncedQuery.trim() || (!isPicker && scope.status !== 'ready') ||
      !nextMapCursor || !hasNextPage || isFetching || isFetchingNextPage || isPaused ||
      isPlaceholderData || isFetchNextPageError || isError) return
    if (mapCursorBudget.current.cursors.has(nextMapCursor)) return
    mapCursorBudget.current.cursors.add(nextMapCursor)
    void fetchNextPage({ cancelRefetch: false })
  }, [mode, mapQueryKey, nextMapCursor, query, debouncedQuery, isPicker, scope.status, hasNextPage, isFetching, isFetchingNextPage, isPaused, isPlaceholderData, isFetchNextPageError, isError, fetchNextPage])
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()
  const addSeedToRoom = useAddRoomSeedPlaces(roomId ?? '')
  const baseResults = useMemo(() => (baseSearch.data?.pages ?? []).flatMap(page => page.results.map(result => toPlaceCard(result, labels))), [baseSearch.data, labels])
  const regionResults = useMemo(() => (regionSearch.data?.pages ?? []).flatMap(page => page.results.map(result => toPlaceCard(result, labels))), [regionSearch.data, labels])
  const [explored, setExplored] = useState({ key: baseKey, places: [] as PlaceCardModel[], data: regionSearch.data })
  if (explored.key !== baseKey) setExplored({ key: baseKey, places: [], data: regionSearch.data })
  else if (viewport && explored.data !== regionSearch.data) setExplored({ key: baseKey, places: [...new Map([...explored.places, ...regionResults].map(place => [place.id, place])).values()], data: regionSearch.data })
  const results = viewport ? [...new Map([...baseResults, ...(explored.key === baseKey ? explored.places : []), ...regionResults].map(place => [place.id, place])).values()] : baseResults
  // A fresh cache belongs to this exact query, even before a fetch after mount.
  const current = (isPicker || scope.status === 'ready') && search.isSuccess && (search.isFetchedAfterMount || search.isStale === false) && !search.isFetching && !search.isPaused && !search.isPlaceholderData && query.trim() === debouncedQuery.trim()
  const verifiedEmpty = current && results.length === 0
  const total = current ? search.data?.pages[0]?.meta?.totalCount : undefined
  // Rollout assumes returned discovery taxonomies and search filters ship together.
  // Count availability and an empty result set cannot revoke filter controls.
  const supports774 = ['mood', 'amenity', 'setting', 'suitability'].some(kind => Object.keys(labels[kind] ?? {}).length > 0) || search.data?.pages[0]?.meta?.totalCount !== undefined || results.some(place => place.discovery !== undefined) || [committed, draft].some(value => value.moods.length + value.amenities.length + value.settings.length > 0)
  const valid = validateFilters(draft)
  const previewQuery: PlaceSearchQuery = { ...(!isPicker ? scopeSearchParams(scope) : originLat != null && originLng != null ? { lat: originLat, lng: originLng } : {}), locale: i18n.language.startsWith('en') ? 'en' : 'vi', ...filterParams(draft), q: query.trim() || undefined }
  const previewKey = JSON.stringify(previewQuery)
  const [settledPreviewKey, setSettledPreviewKey] = useState('')
  useEffect(() => {
    if (!sheetOpen || !valid) return
    const timer = setTimeout(() => setSettledPreviewKey(previewKey), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [previewKey, sheetOpen, valid])
  const previewEnabled = sheetOpen && valid && previewKey === settledPreviewKey && (isPicker || scope.status === 'ready')
  const preview = useDiscoveryPreview(previewQuery, previewEnabled)
  const previewTotal = previewEnabled && preview.isSuccess && !preview.isFetching && !preview.isPaused && !preview.isPlaceholderData ? preview.data?.meta?.totalCount : undefined
  const mapScope = isPicker && originLat != null && originLng != null ? { status: 'ready' as const, source: 'gps' as const, position: { lat: originLat, lng: originLng } } : isPicker ? { status: 'ready' as const, source: 'none' as const, reason: 'no_area' as const } : scope
  const map = discoveryMap(mapScope, results)
  const mapScopeKey = JSON.stringify([mapScope, baseKey])
  const [markerSelection, setMarkerSelection] = useState({ data: search.data, scopeKey: mapScopeKey, mode, id: null as string | null })
  const selectionIsCurrent = (!!viewport || markerSelection.data === search.data) && markerSelection.scopeKey === mapScopeKey && markerSelection.mode === mode
  // Reset before rendering children when the results, scope, or display mode changes.
  if (!selectionIsCurrent) {
    setMarkerSelection({ data: search.data, scopeKey: mapScopeKey, mode, id: null })
  }
  // Reset before rendering children so recovery cannot reopen an expanded map.
  if (mapExpanded && (mode !== 'map' || (!viewport && (search.isPaused || search.isError || verifiedEmpty || search.isPending)))) {
    setMapExpanded(false)
  }
  const selectedMarker = selectionIsCurrent ? markerSelection.id : null
  const selectedPlace = results.find(place => place.id === selectedMarker && map.pins.some(pin => pin.id === place.id))
  const served = baseSearch.data?.pages[0]?.meta?.location
  const scopeLabel = served?.source === 'administrative_area' && served.area ? [served.area.communeName, served.area.provinceName].filter(Boolean).join(', ') : t('home.chooseArea')
  function openFilters() { setSettledPreviewKey(''); Keyboard.dismiss(); setDraft({ ...committed, categories: [...committed.categories] }); setSheetOpen(true) }
  function clearFilters() { setCommitted(emptyFilters()); setDraft(emptyFilters()) }
  function onPlacePress(place: PlaceCardModel) {
    setMapExpanded(false)
    if (isPicker) {
      if (roomId) { addSeedToRoom.mutate({ placeIds: [place.id] }, { onSuccess: () => router.back() }); return }
      addSeedPlace({ placeId: place.id, name: place.name }); router.back(); return
    }
    router.push(`/places/${place.id}`)
  }
  function onBookmark(place: PlaceCardModel) {
    const currentlySaved = isSaved(saved.data, 'place', place.id)
    toggleSaved.mutate({ type: 'place', id: place.id, saved: currentlySaved })
    if (!currentlySaved) track('place_saved', { placeId: place.id })
  }
  function toggleCategory(key: string) { setDraft(prev => ({ ...prev, categories: prev.categories.includes(key) ? prev.categories.filter(value => value !== key) : [...prev.categories, key] })) }
  function toggleOption(field: 'amenities' | 'moods' | 'settings' | 'suited', key: string) {
    setDraft(prev => ({ ...prev, [field]: prev[field].includes(key) ? prev[field].filter(value => value !== key) : [...prev[field], key] }))
  }
  function options(kind: string, field: 'amenities' | 'moods' | 'settings' | 'suited') {
    const available = { ...labels[kind], ...Object.fromEntries(draft[field].filter(key => !labels[kind]?.[key]).map((key, index) => [key, t(kind === 'mood' ? 'discovery.selectedMood' : 'discovery.selectedFilter', { number: index + 1 })])) }
    return Object.entries(available).map(([key, label]) => <Chip appearance="discovery" key={key} label={label} variant={draft[field].includes(key) ? 'selected' : draft[field].length >= 10 ? 'disabled' : 'default'} onPress={() => toggleOption(field, key)} />)
  }
  const contribution = <View style={styles.contribution}>
    <View style={styles.contributionIcon}><MaterialIcon name="storefront" color="redesign.primaryText" size={28} /></View>
    <Text variant="introHeading" color="redesign.ink" style={styles.centerText}>{t('discovery.contributeTitle')}</Text>
    <Text variant="introSmall" color="redesign.secondary" style={styles.centerText}>{t('discovery.contributeBody')}</Text>
    <PrimaryBtn variant="discovery" label={t('discovery.addPlace')} onPress={() => router.push('/places/import')} leadingIcon="addLocation" />
    {canSave && credits.data?.creditBalance !== undefined ? <Text variant="introCaption" color="redesign.secondary" style={styles.centerText}>{t('discovery.approvalReward')}</Text> : null}
  </View>
  function loadMore() {
    if (search.hasNextPage && !search.isFetching && !search.isPaused && !search.isFetchingNextPage && !search.isFetchNextPageError) void search.fetchNextPage({ cancelRefetch: false })
  }
  function renderPagination() {
    if (search.isFetchingNextPage) return <ActivityIndicator testID="search-loading-more" />
    if (search.isFetchNextPageError) return <ErrorState error={search.error} onRetry={() => { if (!search.isFetching && !search.isPaused) void search.fetchNextPage({ cancelRefetch: false }) }} />
    return null
  }
  function renderResults(mapFallback = false) {
    return <FlatList
      testID="search-results" data={results} keyExtractor={place => place.id}
      contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled" onTouchStart={() => Keyboard.dismiss()}
      onEndReachedThreshold={0.5} onEndReached={loadMore}
      ListHeaderComponent={mapFallback ? <Text variant="introSmall" color="redesign.secondary">{t('discovery.mapFallback')}</Text> : null}
      ListEmptyComponent={search.isPending ? <PlaceListSkeleton count={4} /> : verifiedEmpty && !sheetOpen ? <SearchEmpty
        key={JSON.stringify(searchQuery)} filters={committed} labels={labels}
        query={{ ...(!isPicker ? scopeSearchParams(scope) : originLat != null && originLng != null ? { lat: originLat, lng: originLng } : {}), locale: searchQuery.locale, q: debouncedQuery.trim() || undefined }}
        onApply={next => { setCommitted(next); setDraft(next) }}
        onMore={() => { clearFilters(); setQuery(''); setDebouncedQuery(''); setMode('list') }}
        onPlacePress={onPlacePress}
      /> : null}
      ListFooterComponent={<>{!mapFallback ? renderPagination() : null}{results.length > 0 ? contribution : null}</>}
      renderItem={({ item: place }) => {
        const card = <PlaceCard appearance="discovery" place={place} onPress={() => onPlacePress(place)} saved={canSave ? isSaved(saved.data, 'place', place.id) : undefined} onToggleSave={canSave ? () => onBookmark(place) : undefined} style={styles.place} />
        return mapFallback ? <View>{card}<GhostBtn label={t('common.directions')} accessibilityHint={place.name} onPress={() => openGoogleMapsDirections(map.pins.find(pin => pin.id === place.id) ? `${place.lat},${place.lng}` : place.name)} /></View> : card
      }}
    />
  }
  function renderContent() {
    if (!isPicker && scope.status === 'unavailable') return scope.offline ? <OfflineState /> : <ErrorState error={scope.error} onRetry={() => void retryScope()} />
    if (mode === 'map' && search.isPaused && !viewport) return <OfflineState />
    if (search.isError && !search.isFetchNextPageError && !viewport) return <ErrorState error={search.error} onRetry={() => void search.refetch()} />
    if (mode !== 'map' || verifiedEmpty) return renderResults()
    if ((search.isPending && !viewport) || (!isPicker && scope.status !== 'ready')) return <PlaceListSkeleton count={4} />
    return <SearchMapPanel expanded={mapExpanded} onExpandedChange={setMapExpanded}><View testID="search-map" style={styles.mapBlock}>
      <View style={styles.mapBlock}>
        <MapCanvas pins={map.pins} cameraRegion={viewport ?? map.region} cameraScopeKey={mapScopeKey} onRegionChangeComplete={exploreRegion} showsUserLocation={!isPicker && map.showsUserLocation} onSelect={id => setMarkerSelection({ data: search.data, scopeKey: mapScopeKey, mode, id })} onOpen={id => { const place = results.find(result => result.id === id); if (place) onPlacePress(place) }} style={styles.map} fallback={renderResults(true)} />
        {selectedPlace ? <View style={[styles.mapPreview, { bottom: insets.bottom }]}>
          <Text variant="introHeading" color="redesign.ink">{selectedPlace.name}</Text>
          <GhostBtn label={t('discovery.openPlace')} onPress={() => onPlacePress(selectedPlace)} />
        </View> : null}
      </View>
      {viewport && (search.isPaused || (search.isError && !search.isFetchNextPageError)) ? <View testID="search-map-feedback" style={styles.mapFeedback}>
        {search.isPaused ? <OfflineState /> : <ErrorState error={search.error} onRetry={search.isFetching ? undefined : () => { if (!search.isFetching && !search.isPaused) void search.refetch() }} />}
      </View> : null}
      {search.isFetching || search.isFetchNextPageError ? <View testID="search-map-pagination" style={[styles.mapPagination, { bottom: insets.bottom + 8 }]}>
        {search.isFetching ? <ActivityIndicator testID="search-loading-more" size="small" color={theme.redesign.primaryText} /> : <GhostBtn label={t('common.retry')} disabled={search.isFetching || search.isPaused} onPress={() => { if (!search.isFetching && !search.isPaused) void search.fetchNextPage({ cancelRefetch: false }) }} />}
      </View> : null}
    </View></SearchMapPanel>
  }
  return <Atmosphere redesign>
    {!mapExpanded ? <><View testID="search-header" style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back} onPress={() => router.back()}><MaterialIcon name="arrowBack" /></Pressable>
        {isPicker ? <View style={styles.scope}>
          <Text variant="discoveryHeader" color="redesign.ink">{t('discovery.searchTitle')}</Text>
        </View> : <Pressable style={styles.scope} accessibilityRole="button" accessibilityLabel={t('home.chooseArea')} onPress={() => setLocationOpen(true)}>
          <Text variant="discoveryHeader" color="redesign.ink">{t('discovery.searchTitle')}</Text>
          <View style={styles.scopeLabel}><MaterialIcon name="location" size={14} color="redesign.primaryText" /><Text variant="introCaptionMedium" color="redesign.secondary" numberOfLines={1}>{scopeLabel}</Text><MaterialIcon name="expandMore" size={16} color="redesign.secondary" /></View>
        </Pressable>}
        <HeaderNotificationButton testID="search-bell" unreadDotTestID="search-unread-dot" />
      </View>
    </View>
    <View style={styles.searchRow}>
      <SearchField appearance="discovery" value={query} onChangeText={setQuery} accessibilityLabel={t('search.title')} placeholder={t('discovery.searchPlaceholder')} style={styles.input} />
      <IconBtn onPress={openFilters} accessibilityLabel={t('search.filters')} active={activeFilterCount > 0} style={styles.filterToggle}>
        <MaterialIcon name="tune" color="redesign.primaryText" />
        {activeFilterCount > 0 ? <View style={styles.filterDot} /> : null}
      </IconBtn>
    </View>
    <View testID="search-summary-row" style={styles.summaryRow}>
      <View style={styles.summaryCount}><MaterialIcon name="filterList" size={16} color="redesign.secondary" /><Text variant="introCaptionMedium" numberOfLines={1} color="redesign.secondary" style={styles.summaryText}>{total !== undefined || verifiedEmpty ? <Trans i18nKey="discovery.resultSummary" count={total ?? 0} components={{ primary: <Text variant="introCaptionMedium" color="redesign.primaryText" /> }} /> : t('discovery.results')}</Text></View>
      <SegmentedControl compact options={[{ value: 'list', label: t('discovery.list'), icon: 'list' }, { value: 'map', label: t('discovery.map'), icon: 'map' }]} value={mode} onChange={setMode} />
    </View>
    </> : null}
    {renderContent()}
    {verifiedEmpty ? <View style={[styles.emptyActions, { paddingBottom: insets.bottom + 8 }]}>
      <PrimaryBtn variant="discovery" label={t('discovery.resetSearch')} leadingIcon="tune" onPress={() => { clearFilters(); setQuery('') }} />
      {isAssistantEntryOn() ? <SecondaryBtn variant="discovery" label={t('discovery.askAI')} leadingIcon="sparkle" onPress={() => router.push(assistantHref())} /> : null}
    </View> : null}
    <Sheet appearance="discovery" visible={sheetOpen} onClose={() => { setSheetOpen(false); setDraft(committed) }}
      header={<View style={styles.sheetHeader}><View style={styles.sheetTitle}><MaterialIcon name="tune" color="redesign.primaryText" size={22} /><Text variant="introHeading">{t('discovery.filterTitle')}</Text></View><GhostBtn label={t('search.clearFilters')} onPress={() => setDraft(emptyFilters())} /></View>}
      footer={<View style={styles.sheetFooter}><IconBtn accessibilityLabel={t('discovery.resetDefaults')} onPress={() => setDraft(emptyFilters())}><MaterialIcon name="restart" /></IconBtn><PrimaryBtn variant="discovery" label={previewTotal !== undefined ? t('discovery.previewCount', { count: previewTotal }) : t('discovery.apply')} disabled={!valid} style={{ flex: 1 }} onPress={() => { if (valid) { Keyboard.dismiss(); setCommitted(draft); setSheetOpen(false) } }} /></View>}>
      <Text variant="introHeading" style={styles.sheetSection}>{t('discovery.amenities')}</Text>
      <View testID="amenity-status-options" style={styles.sheetOptionRow}><Chip appearance="discovery" label={t('discovery.openNow')} variant={draft.openNow ? 'selected' : 'default'} onPress={() => setDraft(prev => ({ ...prev, openNow: !prev.openNow }))} />{supports774 ? options('amenity', 'amenities') : null}</View>
      <View style={styles.priceHeading}><Text variant="introHeading">{t('discovery.priceRange')}</Text></View>
      <FieldFocusGroup>
      <View style={styles.priceRow}>
        <View style={styles.priceField}><Text variant="introCaption" color="redesign.secondary">{t('discovery.priceFrom')}</Text><View style={styles.priceInputRow}><TextInput value={draft.priceFrom} onChangeText={priceFrom => setDraft(prev => ({ ...prev, priceFrom }))} accessibilityLabel={t('search.priceFromLabel')} keyboardType="numeric" placeholderTextColor={theme.redesign.secondary} style={styles.priceText} /><Text variant="introHeading" color="redesign.ink">{t('search.priceSuffix')}</Text></View></View>
        <View style={styles.priceField}><Text variant="introCaption" color="redesign.secondary">{t('discovery.priceTo')}</Text><View style={styles.priceInputRow}><TextInput value={draft.priceTo} onChangeText={priceTo => setDraft(prev => ({ ...prev, priceTo }))} accessibilityLabel={t('search.priceToLabel')} keyboardType="numeric" placeholderTextColor={theme.redesign.secondary} style={styles.priceText} /><Text variant="introHeading" color="redesign.ink">{t('search.priceSuffix')}</Text></View></View>
      </View>
      {!valid ? <Text variant="introSmall" color="status.dangerText" accessibilityLiveRegion="polite">{t('discovery.invalidPrice')}</Text> : null}
      </FieldFocusGroup>
      <View testID="price-presets" style={styles.sheetOptionRow}>{[{ label: t('discovery.priceLow'), from: '30', to: '80' }, { label: t('discovery.priceMid'), from: '80', to: '250' }, { label: t('discovery.priceHigh'), from: '250', to: '600' }].map(preset => <Chip appearance="discovery" key={preset.label} label={preset.label} variant={draft.priceFrom === preset.from && draft.priceTo === preset.to ? 'selected' : 'default'} onPress={() => setDraft(prev => ({ ...prev, priceFrom: preset.from, priceTo: preset.to }))} />)}</View>
      <Text variant="introHeading" style={styles.sheetSection}>{t('search.filterSuited')}</Text>
      <View style={styles.sheetOptionRow}>{supports774 ? options('suitability', 'suited') : (['couple', 'group'] as const).map(option => <Chip appearance="discovery" key={option} label={option === 'couple' ? t('discovery.couple') : t('discovery.group')} variant={draft.suited.includes(option) ? 'selected' : 'default'} onPress={() => setDraft(prev => ({ ...prev, suited: prev.suited.includes(option) ? [] : [option] }))} />)}</View>
      {(Object.keys(labels.mood ?? {}).length || draft.moods.length) ? <><Text variant="introHeading" style={styles.sheetSection}>{t('discovery.moods')}</Text><View style={styles.sheetOptionRow}>{options('mood', 'moods')}</View></> : null}
      {(Object.keys(labels.setting ?? {}).length || draft.settings.length) ? <><Text variant="introHeading" style={styles.sheetSection}>{t('discovery.settings')}</Text><View style={styles.sheetOptionRow}>{options('setting', 'settings')}</View></> : null}
      <Text variant="introHeading" style={styles.sheetSection}>{t('search.filterCategory')}</Text>
      <View style={styles.sheetOptionRow}>{Object.entries(labels.category ?? {}).map(([key, label]) => <Chip appearance="discovery" key={key} label={label} variant={draft.categories.includes(key) ? 'selected' : draft.categories.length >= 10 ? 'disabled' : 'default'} onPress={() => toggleCategory(key)} />)}</View>
      <View style={styles.smartBanner}><MaterialIcon name="sparkle" size={24} color="redesign.violetText" /><View style={{ flex: 1 }}><Text variant="introLabel">{t('discovery.smartTitle')}</Text><Text variant="introSmall" color="redesign.secondary">{t('discovery.smartBody')}</Text></View></View>
    </Sheet>
    <DiscoveryLocationSheet visible={locationOpen} onClose={() => setLocationOpen(false)} onApplied={() => { setScopeOverridden(true); void recheck() }} />
  </Atmosphere>
}
