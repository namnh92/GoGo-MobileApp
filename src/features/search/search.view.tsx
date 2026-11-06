import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import {
  useAddRoomSeedPlaces, isSaved, toPlaceCard, useSaved, useTaxonomies, useToggleSaved, usePlaceSearch, useMe, useDiscoveryPreview, useContributionCredits, discoveryLabels,
  type PlaceCard as PlaceCardModel, type PlaceSearchQuery,
} from '@/shared/api'
import { assistantHref } from '@/features/assistant/assistant-entry'
import { isAssistantEntryOn } from '@/shared/config/features'
import { track } from '@/shared/analytics'
import { scopeSearchParams, useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Atmosphere, AvatarCircle, Chip, GhostBtn, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
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
import { discoveryMap } from './discovery-map'
import { styles } from './search.style'
import { emptyFilters, filterParams, validateFilters, type DiscoveryFilters } from './discovery-filters'

const SEARCH_DEBOUNCE_MS = 300

export default function SearchScreen() {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { picker, q, filters, roomId, moods } = useLocalSearchParams<{ picker?: string; q?: string; filters?: string; roomId?: string; moods?: string }>()
  const { status } = useSession()
  const isPicker = picker === '1'
  const canSave = status === 'user'
  const me = useMe({ enabled: status === 'user' || status === 'guest' })
  const selectedArea = useDiscoveryAreaStore(state => state.area)
  const { scope, recheck, retry: retryScope } = useDiscoveryScope({ selectedArea, profileArea: status === 'user' ? me.data?.homeAdministrativeArea : null, profilePending: status === 'hydrating' || (status === 'user' && me.isPending) })
  const originLat = useRoomStore(state => state.originLat)
  const originLng = useRoomStore(state => state.originLng)
  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  const [query, setQuery] = useState(q ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(q ?? '')
  const [committed, setCommitted] = useState<DiscoveryFilters>(() => ({ ...emptyFilters(), moods: moods?.split(',').filter(Boolean) ?? [] }))
  const [draft, setDraft] = useState<DiscoveryFilters>(emptyFilters)
  const [sheetOpen, setSheetOpen] = useState(filters === '1')
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
    locale: i18n.language.startsWith('en') ? 'en' : 'vi', includeTotal: true,
    ...applied, ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }), [isPicker, scope, originLat, originLng, applied, debouncedQuery, i18n.language])
  const search = usePlaceSearch(searchQuery, { enabled: isPicker || scope.status === 'ready' })
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()
  const addSeedToRoom = useAddRoomSeedPlaces(roomId ?? '')
  const results = useMemo(() => (search.data?.pages ?? []).flatMap(page => page.results.map(result => toPlaceCard(result, labels))), [search.data, labels])
  // Cached/offline/pending/error results never assert a successful zero result.
  const verifiedEmpty = search.isSuccess && search.isFetchedAfterMount && !search.isFetching && !search.isPaused && !search.isPlaceholderData && query.trim() === debouncedQuery.trim() && results.length === 0
  const current = search.isSuccess && search.isFetchedAfterMount && !search.isFetching && !search.isPaused && !search.isPlaceholderData && query.trim() === debouncedQuery.trim()
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
  const map = discoveryMap(mapScope, results, t('createLocation.current'))
  const served = search.data?.pages[0]?.meta?.location
  const scopeLabel = served?.source === 'gps' ? t('home.scopeGps') : served?.source === 'administrative_area' && served.area ? [served.area.communeName, served.area.provinceName].filter(Boolean).join(', ') : t('home.chooseArea')
  function openFilters() { setSettledPreviewKey(''); Keyboard.dismiss(); setDraft({ ...committed, categories: [...committed.categories] }); setSheetOpen(true) }
  function clearFilters() { setCommitted(emptyFilters()); setDraft(emptyFilters()) }
  function onPlacePress(place: PlaceCardModel) {
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
    <MaterialIcon name="location" color="redesign.primaryText" size={28} />
    <Text variant="introHeading" color="redesign.ink">{t('discovery.contributeTitle')}</Text>
    <Text variant="introSmall" color="redesign.secondary" style={styles.centerText}>{t('discovery.contributeBody')}</Text>
    <SecondaryBtn label={t('search.addPlace')} onPress={() => router.push('/places/import')} leadingIcon="plus" />
    {canSave && credits.data?.creditBalance !== undefined ? <Text variant="introSmall" color="redesign.secondary" style={styles.centerText}>{t('discovery.approvalReward')}</Text> : null}
  </View>
  return <Atmosphere redesign>
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back} onPress={() => router.back()}><MaterialIcon name="arrowBack" /></Pressable>
        <Pressable style={styles.scope} accessibilityRole="button" accessibilityLabel={t('home.chooseArea')} onPress={() => router.push('/places/location')}>
          <Text variant="discoveryHeader" color="redesign.ink">{t('discovery.searchTitle')}</Text>
          {!isPicker ? <View style={styles.scopeLabel}><MaterialIcon name="location" size={14} color="redesign.primaryText" /><Text variant="introCaptionMedium" color="redesign.secondary" numberOfLines={1}>{scopeLabel}</Text></View> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.title')} style={styles.avatar} onPress={() => router.push('/settings/account')}>
          {me.data?.displayName?.trim() ? <AvatarCircle label={me.data.displayName.trim().charAt(0).toUpperCase()} size={32} imageUri={me.data.avatarUrl} /> : <MaterialIcon name="user" />}
        </Pressable>
      </View>
    </View>
    <View style={styles.searchRow}>
      <SearchField appearance="discovery" value={query} onChangeText={setQuery} accessibilityLabel={t('search.title')} placeholder={t('discovery.searchPlaceholder')} style={styles.input} />
      <IconBtn onPress={openFilters} accessibilityLabel={t('search.filters')} active={activeFilterCount > 0} style={styles.filterToggle}>
        <MaterialIcon name="tune" color="redesign.primaryText" />
        {activeFilterCount > 0 ? <View style={styles.filterDot} /> : null}
      </IconBtn>
    </View>
    <View style={styles.summaryRow}>
      <Text variant="introSmall" color="redesign.secondary">{total !== undefined ? t('discovery.totalCount', { count: total }) : verifiedEmpty ? t('discovery.zeroCount') : t('discovery.results')}</Text>
      <SegmentedControl compact options={[{ value: 'list', label: t('discovery.list'), icon: 'list' }, { value: 'map', label: t('discovery.map'), icon: 'map' }]} value={mode} onChange={setMode} />
    </View>
    {!isPicker && scope.status === 'unavailable' ? scope.offline ? <OfflineState /> : <ErrorState error={scope.error} onRetry={() => void retryScope()} /> : search.isError ? <ErrorState error={search.error} onRetry={() => void search.refetch()} /> : <FlatList
      testID="search-results" data={results} keyExtractor={place => place.id}
      contentContainerStyle={[styles.results, { paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled" onTouchStart={() => Keyboard.dismiss()}
      onEndReachedThreshold={0.5} onEndReached={() => { if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage() }}
      ListHeaderComponent={mode === 'map' ? <View style={styles.mapBlock}>
        <MapCanvas pins={map.pins} cameraRegion={map.region} onSelect={id => { const place = results.find(item => item.id === id); if (place) onPlacePress(place) }} style={styles.map} fallback={<Text variant="introSmall" color="redesign.secondary">{t('discovery.mapFallback')}</Text>} />
        {map.region ? <Text variant="introCaption" color="redesign.secondary">{t(mapScope.status === 'ready' && mapScope.source === 'gps' ? 'discovery.mapCurrentLocation' : 'discovery.mapTopPlace')}</Text> : null}
      </View> : null}
      ListEmptyComponent={search.isPending ? <PlaceListSkeleton count={4} /> : verifiedEmpty ? <View style={styles.empty}>
        <View style={styles.emptyIcon}><MaterialIcon name="explore" size={38} color="redesign.primaryText" /></View>
        <Text variant="discoveryHeading" color="redesign.ink" style={styles.centerText}>{t('discovery.emptyTitle')}</Text>
        <Text variant="introCaption" color="redesign.secondary" style={styles.emptyHint}>{t('discovery.emptyBody')}</Text>
      </View> : null}
      ListFooterComponent={<>{search.isFetchingNextPage ? <ActivityIndicator /> : null}{contribution}</>}
      renderItem={({ item: place }) => <PlaceCard appearance="discovery" place={place} onPress={() => onPlacePress(place)} saved={canSave ? isSaved(saved.data, 'place', place.id) : undefined} onToggleSave={canSave ? () => onBookmark(place) : undefined} style={styles.place} />}
    />}
    {verifiedEmpty ? <View style={[styles.emptyActions, { paddingBottom: insets.bottom + 8 }]}>
      <PrimaryBtn variant="discovery" label={t('discovery.resetSearch')} leadingIcon="tune" onPress={() => { clearFilters(); setQuery('') }} />
      {isAssistantEntryOn() ? <SecondaryBtn label={t('discovery.askAI')} leadingIcon="sparkle" onPress={() => router.push(assistantHref())} /> : null}
    </View> : null}
    <Sheet appearance="discovery" visible={sheetOpen} onClose={() => { setSheetOpen(false); setDraft(committed) }}
      header={<View style={styles.sheetHeader}><View style={styles.sheetTitle}><MaterialIcon name="tune" color="redesign.primaryText" size={22} /><Text variant="introHeading">{t('discovery.filterTitle')}</Text></View><GhostBtn label={t('search.clearFilters')} onPress={() => setDraft(emptyFilters())} /></View>}
      footer={<View style={styles.sheetFooter}><IconBtn accessibilityLabel={t('discovery.resetDefaults')} onPress={() => setDraft(emptyFilters())}><MaterialIcon name="restart" /></IconBtn><PrimaryBtn variant="discovery" label={previewTotal !== undefined ? t('discovery.previewCount', { count: previewTotal }) : t('discovery.apply')} disabled={!valid} style={{ flex: 1 }} onPress={() => { if (valid) { Keyboard.dismiss(); setCommitted(draft); setSheetOpen(false) } }} /></View>}>
      <Text variant="introHeading" style={styles.sheetSection}>{t('discovery.amenities')}</Text>
      <View testID="open-now-options" style={styles.sheetOptionRow}><Chip appearance="discovery" label={t('discovery.openNow')} variant={draft.openNow ? 'selected' : 'default'} onPress={() => setDraft(prev => ({ ...prev, openNow: !prev.openNow }))} /></View>
      {supports774 ? <View style={styles.sheetOptionRow}>{options('amenity', 'amenities')}</View> : null}
      <View style={styles.priceHeading}><Text variant="introHeading">{t('discovery.priceRange')}</Text></View>
      <FieldFocusGroup>
      <View style={styles.priceRow}>
        <View style={styles.priceField}><Text variant="introCaption" color="redesign.secondary">{t('discovery.priceFrom')}</Text><View style={styles.priceInputRow}><TextInput value={draft.priceFrom} onChangeText={priceFrom => setDraft(prev => ({ ...prev, priceFrom }))} accessibilityLabel={t('search.priceFromLabel')} keyboardType="numeric" placeholder={t('search.priceFrom')} placeholderTextColor={theme.redesign.secondary} style={styles.priceText} /><Text variant="introHeading" color="redesign.ink">{t('search.priceSuffix')}</Text></View></View>
        <View style={styles.priceField}><Text variant="introCaption" color="redesign.secondary">{t('discovery.priceTo')}</Text><View style={styles.priceInputRow}><TextInput value={draft.priceTo} onChangeText={priceTo => setDraft(prev => ({ ...prev, priceTo }))} accessibilityLabel={t('search.priceToLabel')} keyboardType="numeric" placeholder={t('search.priceTo')} placeholderTextColor={theme.redesign.secondary} style={styles.priceText} /><Text variant="introHeading" color="redesign.ink">{t('search.priceSuffix')}</Text></View></View>
      </View>
      {!valid ? <Text variant="introSmall" color="status.dangerText" accessibilityLiveRegion="polite">{t('discovery.invalidPrice')}</Text> : null}
      </FieldFocusGroup>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetOptionRow}>{[{ label: t('discovery.priceLow'), from: '30', to: '80' }, { label: t('discovery.priceMid'), from: '80', to: '250' }, { label: t('discovery.priceHigh'), from: '250', to: '600' }].map(preset => <Chip appearance="discovery" key={preset.label} label={preset.label} variant={draft.priceFrom === preset.from && draft.priceTo === preset.to ? 'selected' : 'default'} onPress={() => setDraft(prev => ({ ...prev, priceFrom: preset.from, priceTo: preset.to }))} />)}</ScrollView>
      <Text variant="introHeading" style={styles.sheetSection}>{t('search.filterSuited')}</Text>
      <View style={styles.sheetOptionRow}>{supports774 ? options('suitability', 'suited') : (['couple', 'group'] as const).map(option => <Chip appearance="discovery" key={option} label={option === 'couple' ? t('discovery.couple') : t('discovery.group')} variant={draft.suited.includes(option) ? 'selected' : 'default'} onPress={() => setDraft(prev => ({ ...prev, suited: prev.suited.includes(option) ? [] : [option] }))} />)}</View>
      {(Object.keys(labels.mood ?? {}).length || draft.moods.length) ? <><Text variant="introHeading" style={styles.sheetSection}>{t('discovery.moods')}</Text><View style={styles.sheetOptionRow}>{options('mood', 'moods')}</View></> : null}
      {(Object.keys(labels.setting ?? {}).length || draft.settings.length) ? <><Text variant="introHeading" style={styles.sheetSection}>{t('discovery.settings')}</Text><View style={styles.sheetOptionRow}>{options('setting', 'settings')}</View></> : null}
      <Text variant="introHeading" style={styles.sheetSection}>{t('search.filterCategory')}</Text>
      <View style={styles.sheetOptionRow}>{Object.entries(labels.category ?? {}).map(([key, label]) => <Chip appearance="discovery" key={key} label={label} variant={draft.categories.includes(key) ? 'selected' : draft.categories.length >= 10 ? 'disabled' : 'default'} onPress={() => toggleCategory(key)} />)}</View>
      <View style={styles.smartBanner}><MaterialIcon name="sparkle" size={24} color="redesign.violetText" /><View style={{ flex: 1 }}><Text variant="introLabel">{t('discovery.smartTitle')}</Text><Text variant="introSmall" color="redesign.secondary">{t('discovery.smartBody')}</Text></View></View>
    </Sheet>
  </Atmosphere>
}
