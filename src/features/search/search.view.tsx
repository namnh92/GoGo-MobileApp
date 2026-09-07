import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  useAddRoomSeedPlaces,
  isSaved,
  toPlaceCard,
  useSaved,
  useTaxonomies,
  useToggleSaved,
  usePlaceSearch,
  type PlaceCard as PlaceCardModel,
  type PlaceSearchQuery,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { ErrorState } from '@/shared/ui/async-state.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Atmosphere, BackHeader, Chip, GhostBtn, IconBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { PlaceListSkeleton } from '@/shared/ui/skeleton.view'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './search.style'

const SUITED_OPTIONS = ['couple', 'group'] as const
const SEARCH_DEBOUNCE_MS = 300
/** Price inputs are typed in thousands of dong; the API wants minor units. */
const PRICE_INPUT_MULTIPLIER = 1000

function parseNum(value: string): number | null {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export default function SearchScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { picker, q, filters, roomId } = useLocalSearchParams<{
    picker?: string
    q?: string
    filters?: string
    roomId?: string
  }>()
  const { status } = useSession()

  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  // Distance only means something relative to an origin, and the wizard's area
  // pick is the only origin the app has without a location permission.
  const originLat = useRoomStore(state => state.originLat)
  const originLng = useRoomStore(state => state.originLng)
  const hasOrigin = originLat != null && originLng != null

  const [query, setQuery] = useState(q ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(q ?? '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sheetOpen, setSheetOpen] = useState(filters === '1')
  const [maxKm, setMaxKm] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [suited, setSuited] = useState<(typeof SUITED_OPTIONS)[number] | null>(null)

  const isPicker = picker === '1'
  const canSave = status === 'user'

  const taxonomies = useTaxonomies({ kinds: 'category' })
  const categories = useMemo(() => {
    const entries = taxonomies.data?.kinds?.category ?? []
    return entries.map(entry => ({
      key: entry.key ?? '',
      label: entry.labels?.[i18n.language] ?? entry.labels?.vi ?? entry.key ?? '',
    }))
  }, [taxonomies.data, i18n.language])

  useEffect(() => {
    track('place_search_opened', { picker: isPicker })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close the sheet whenever this screen loses focus — a live Modal would
  // otherwise overlay whatever screen we navigate to.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setTimeout(() => setSheetOpen(false), 0)
      }
    }, []),
  )

  useEffect(() => {
    if (filters === '1') {
      const timer = setTimeout(() => setSheetOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const maxKmNum = parseNum(maxKm)
  const priceFromNum = parseNum(priceFrom)
  const priceToNum = parseNum(priceTo)

  const activeFilterCount =
    (maxKmNum !== null ? 1 : 0) +
    (priceFromNum !== null || priceToNum !== null ? 1 : 0) +
    (suited !== null ? 1 : 0) +
    (selectedCategories.length > 0 ? 1 : 0)

  /**
   * Every filter is a server parameter. Filtering locally over a cursor-paged
   * list would only ever filter the page in hand, so "no results" and the
   * distance and price facts would stop matching what the ranking actually did.
   */
  const searchQuery: PlaceSearchQuery = useMemo(() => {
    const params: PlaceSearchQuery = {}
    const trimmed = debouncedQuery.trim()
    if (trimmed) params.q = trimmed
    if (selectedCategories.length > 0) params.categories = selectedCategories.join(',')
    if (suited) params.suitedFor = suited
    if (priceFromNum !== null) params.priceMinPerPerson = Math.round(priceFromNum * PRICE_INPUT_MULTIPLIER)
    if (priceToNum !== null) params.priceMaxPerPerson = Math.round(priceToNum * PRICE_INPUT_MULTIPLIER)
    if (hasOrigin) {
      params.lat = originLat as number
      params.lng = originLng as number
      if (maxKmNum !== null) {
        params.radiusM = Math.round(maxKmNum * 1000)
        // The server rejects `sort=distance` without an origin, so it is only
        // requested alongside one.
        params.sort = 'distance'
      }
    }
    return params
  }, [debouncedQuery, selectedCategories, suited, priceFromNum, priceToNum, hasOrigin, originLat, originLng, maxKmNum])

  // With a roomId the picker attaches straight to that room; without one it
  // fills the create-wizard draft for a room that does not exist yet.
  const addSeedToRoom = useAddRoomSeedPlaces(roomId ?? '')
  const search = usePlaceSearch(searchQuery)
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  const results: PlaceCardModel[] = useMemo(
    () => (search.data?.pages ?? []).flatMap(page => page.results.map(toPlaceCard)),
    [search.data],
  )

  function onPlacePress(place: PlaceCardModel) {
    if (isPicker) {
      if (roomId) {
        addSeedToRoom.mutate(
          { placeIds: [place.id] },
          { onSuccess: () => router.back() },
        )
        return
      }
      addSeedPlace({ placeId: place.id, name: place.name })
      router.back()
      return
    }
    router.push(`/places/${place.id}`)
  }

  function onBookmark(place: PlaceCardModel) {
    const currentlySaved = isSaved(saved.data, 'place', place.id)
    toggleSaved.mutate({ type: 'place', id: place.id, saved: currentlySaved })
    if (!currentlySaved) track('place_saved', { placeId: place.id })
  }

  function clearFilters() {
    setSelectedCategories([])
    setMaxKm('')
    setPriceFrom('')
    setPriceTo('')
    setSuited(null)
  }

  function toggleCategory(key: string) {
    setSelectedCategories(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]))
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} title={t('search.title')} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.neutral[500]}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />
        <IconBtn
          onPress={() => setSheetOpen(true)}
          accessibilityLabel={t('search.filters')}
          active={activeFilterCount > 0}
          style={styles.filterToggle}
        >
          <Text style={styles.filterToggleIcon}>⚙️</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountLabel}>{activeFilterCount}</Text>
            </View>
          )}
        </IconBtn>
      </View>

      <View style={styles.filterRow}>
        <Chip
          label={content.searchFilters[0]}
          variant={selectedCategories.length === 0 ? 'selected' : 'default'}
          onPress={() => setSelectedCategories([])}
        />
        {categories.map(category => (
          <Chip
            key={category.key}
            label={category.label}
            variant={selectedCategories.includes(category.key) ? 'selected' : 'default'}
            onPress={() => toggleCategory(category.key)}
          />
        ))}
      </View>

      {search.isError ? (
        <ErrorState error={search.error} onRetry={() => void search.refetch()} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={place => place.id}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[1],
            paddingBottom: insets.bottom + 96,
          }}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage()
          }}
          ListEmptyComponent={
            search.isPending ? (
              // A skeleton in the shape of the results, not a bare spinner.
              <PlaceListSkeleton count={4} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>{t('search.empty')}</Text>
                <Text style={styles.emptyHint}>{t('search.emptyHint')}</Text>
                <GhostBtn label={t('search.clearFilters')} onPress={clearFilters} />
              </View>
            )
          }
          ListFooterComponent={
            search.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing[4] }} /> : null
          }
          renderItem={({ item: place }) => (
            <PlaceCard
              place={place}
              onPress={() => onPlacePress(place)}
              tags={place.reasonCodes.map(code => t(`search.reason.${code}`, { defaultValue: code }))}
              saved={canSave ? isSaved(saved.data, 'place', place.id) : undefined}
              onToggleSave={canSave ? () => onBookmark(place) : undefined}
              style={{ marginBottom: spacing[3] }}
            />
          )}
        />
      )}

      {/* Floating add-place button — always available (SRS FR-PLACE-001) */}
      <Pressable
        onPress={() => router.push('/places/import')}
        accessibilityRole="button"
        accessibilityLabel={t('search.addNew')}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing[5] }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <View style={[styles.sheet, { maxHeight: '85%' }]}>
            <View style={styles.handle} />
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing[5] }}
            >
              <Text style={styles.sheetTitle}>{t('search.filters')}</Text>

              <Text style={styles.sheetSection}>{t('search.filterDistance')}</Text>
              {hasOrigin ? (
                <TextInput
                  value={maxKm}
                  onChangeText={setMaxKm}
                  placeholder={t('search.distancePlaceholder')}
                  placeholderTextColor={colors.neutral[500]}
                  keyboardType="numeric"
                  style={styles.sheetInput}
                />
              ) : (
                // Without an origin the server cannot rank by distance, and a
                // disabled control with a reason beats one that silently no-ops.
                <Text style={styles.sheetHint}>{t('search.distanceNeedsArea')}</Text>
              )}

              <Text style={styles.sheetSection}>{t('search.filterPrice')}</Text>
              <View style={styles.priceRow}>
                <TextInput
                  value={priceFrom}
                  onChangeText={setPriceFrom}
                  placeholder={t('search.priceFrom')}
                  placeholderTextColor={colors.neutral[500]}
                  keyboardType="numeric"
                  style={[styles.sheetInput, styles.priceInput]}
                />
                <Text style={styles.priceDash}>–</Text>
                <TextInput
                  value={priceTo}
                  onChangeText={setPriceTo}
                  placeholder={t('search.priceTo')}
                  placeholderTextColor={colors.neutral[500]}
                  keyboardType="numeric"
                  style={[styles.sheetInput, styles.priceInput]}
                />
              </View>

              <Text style={styles.sheetSection}>{t('search.filterSuited')}</Text>
              <View style={styles.sheetOptionRow}>
                {SUITED_OPTIONS.map((option, index) => (
                  <Chip
                    key={option}
                    label={content.suitedOptions[index] ?? option}
                    variant={suited === option ? 'selected' : 'default'}
                    onPress={() => setSuited(suited === option ? null : option)}
                  />
                ))}
              </View>

              <Text style={styles.sheetSection}>{t('search.filterCategory')}</Text>
              <View style={styles.sheetOptionRow}>
                {categories.map(category => (
                  <Chip
                    key={category.key}
                    label={category.label}
                    variant={selectedCategories.includes(category.key) ? 'selected' : 'default'}
                    onPress={() => toggleCategory(category.key)}
                  />
                ))}
              </View>

              <PrimaryBtn label={t('search.apply')} onPress={() => setSheetOpen(false)} style={styles.sheetApply} />
              <Pressable
                accessibilityRole="button"
                onPress={clearFilters}
                style={styles.sheetClear}
              >
                <Text style={styles.sheetClearLabel}>{t('search.clearFilters')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Atmosphere>
  )
}
