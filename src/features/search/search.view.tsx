import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { unsplashUrl } from '@/data/mockData'
import type { SavedPlace } from '@/data/types'
import { useCatalogPlaces } from '@/shared/api/mock'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useBookmarkStore } from '@/shared/store/bookmarkStore'
import { useImportStore } from '@/shared/store/importStore'
import { useRoom } from '@/shared/store/roomStore'
import { usePriceFormatter } from '@/shared/pricing'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, RemoteImage, TagChip } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './search.style'

// Category filter → place category emoji groups (mock retrieval stand-in).
const FILTER_EMOJI: Record<number, string[]> = {
  1: ['🍣', '🍜', '📍'],
  2: ['☕'],
  3: ['🎨'],
  4: ['🌃'],
  5: ['🛏'],
}

const DISTANCE_MAX = [2, 5, Infinity]
const PRICE_BOUNDS: [number, number][] = [
  [0, 100],
  [100, 300],
  [300, Infinity],
]
const SUITED_KEYS = ['couple', 'group'] as const

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export default function SearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { picker, q, filters } = useLocalSearchParams<{ picker?: string; q?: string; filters?: string }>()
  const { perPersonPrice } = usePriceFormatter()
  const catalog = useCatalogPlaces()
  const importedPlaces = useImportStore(s => s.importedPlaces)
  const bookmarked = useBookmarkStore(s => s.bookmarked)
  const toggleBookmark = useBookmarkStore(s => s.toggleBookmark)
  const addSeedPlace = useRoom().addSeedPlace
  const [query, setQuery] = useState(q ?? '')
  const [categoryIndex, setCategoryIndex] = useState(0)
  // Filter sheet state: index into option lists, null = no constraint.
  const [sheetOpen, setSheetOpen] = useState(filters === '1')
  const [distanceIdx, setDistanceIdx] = useState<number | null>(null)
  const [priceIdx, setPriceIdx] = useState<number | null>(null)
  const [suitedIdx, setSuitedIdx] = useState<number | null>(null)
  const isPicker = picker === '1'

  useEffect(() => {
    track('place_search_opened', { picker: isPicker })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (filters === '1') {
      const timer = setTimeout(() => setSheetOpen(true), 0)
      return () => clearTimeout(timer)
    }
  }, [filters])

  const activeFilterCount = [distanceIdx, priceIdx, suitedIdx].filter(x => x !== null).length

  const places = [...importedPlaces, ...(catalog.data ?? [])]
  const needle = normalize(query.trim())
  const filtered = places.filter(p => {
    if (categoryIndex > 0 && !FILTER_EMOJI[categoryIndex]?.includes(p.category)) return false
    if (distanceIdx !== null && p.distanceKm > DISTANCE_MAX[distanceIdx]) return false
    if (priceIdx !== null && p.priceK > 0) {
      const per = p.priceK / 2
      const [min, max] = PRICE_BOUNDS[priceIdx]
      if (per < min || per >= max) return false
    }
    if (suitedIdx !== null && p.suitedFor && !p.suitedFor.includes(SUITED_KEYS[suitedIdx])) return false
    if (!needle) return true
    return normalize(`${p.title} ${p.area} ${p.tags.join(' ')}`).includes(needle)
  })

  function onPlacePress(place: SavedPlace) {
    if (isPicker) {
      addSeedPlace(place)
      router.back()
      return
    }
    router.push('/places/sakura-omakase')
  }

  function onBookmark(place: SavedPlace) {
    toggleBookmark(place.title)
    track('place_saved', { place: place.title })
  }

  function hoursLabel(place: SavedPlace): string {
    if (place.open) {
      return place.closeAt ? t('search.openUntil', { time: place.closeAt }) : t('common.open')
    }
    return place.openAt ? t('search.closedOpens', { time: place.openAt }) : t('common.closed')
  }

  function clearFilters() {
    setDistanceIdx(null)
    setPriceIdx(null)
    setSuitedIdx(null)
  }

  function optionRow(
    options: readonly string[],
    selected: number | null,
    onSelect: (i: number | null) => void,
  ) {
    return (
      <View style={styles.sheetOptionRow}>
        {options.map((label, i) => {
          const active = selected === i
          return (
            <Pressable
              key={label}
              onPress={() => onSelect(active ? null : i)}
              accessibilityState={{ selected: active }}
              style={[styles.sheetOption, active && styles.sheetOptionActive]}
            >
              <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    )
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
          placeholderTextColor={colors.neutral[300]}
          autoCorrect={false}
          style={styles.input}
        />
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('search.filters')}
          style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]}
        >
          <Text style={styles.filterToggleIcon}>⚙️</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterCountBadge}>
              <Text style={styles.filterCountLabel}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {content.searchFilters.map((label, i) => (
          <Pressable key={label} onPress={() => setCategoryIndex(i)} style={[styles.filterBtn, categoryIndex === i && styles.filterBtnActive]}>
            <Text style={[styles.filterLabel, categoryIndex === i && styles.filterLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[1], paddingBottom: insets.bottom + spacing[6] }}>
        {filtered.map(place => (
          <Pressable key={place.title} onPress={() => onPlacePress(place)}>
            <GlassCard style={styles.card}>
              <RemoteImage uri={unsplashUrl(place.img, 200, 200)} style={styles.thumb} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.title} numberOfLines={1}>{place.title}</Text>
                  <Pressable
                    onPress={() => onBookmark(place)}
                    hitSlop={8}
                    accessibilityRole="togglebutton"
                    accessibilityState={{ checked: bookmarked.includes(place.title) }}
                    accessibilityLabel={t('placeDetail.save')}
                  >
                    <Text style={styles.bookmark}>{bookmarked.includes(place.title) ? '🔖' : '📑'}</Text>
                  </Pressable>
                </View>
                <Text style={place.open ? styles.statusOpen : styles.statusClosed} numberOfLines={1}>
                  {hoursLabel(place)}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {place.area} · {place.distanceKm} km{place.priceK > 0 ? ` · ${perPersonPrice(place.priceK)}` : ''}
                </Text>
                <View style={styles.tagRow}>
                  {place.tags.slice(0, 2).map(tag => (
                    <TagChip key={tag} label={tag} />
                  ))}
                  <Text style={styles.score}>♥ {place.score}</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ))}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>{t('search.empty')}</Text>
            <Text style={styles.emptyHint}>{t('search.emptyHint')}</Text>
            <PrimaryBtn label={t('search.addNew')} onPress={() => router.push('/places/import')} style={styles.addNewBtn} />
          </View>
        )}
      </ScrollView>

      {/* Multi-criteria filter sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5] }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('search.filters')}</Text>

          <Text style={styles.sheetSection}>{t('search.filterDistance')}</Text>
          {optionRow(content.distanceOptions, distanceIdx, setDistanceIdx)}

          <Text style={styles.sheetSection}>{t('search.filterPrice')}</Text>
          {optionRow(content.pricePerPersonOptions, priceIdx, setPriceIdx)}

          <Text style={styles.sheetSection}>{t('search.filterSuited')}</Text>
          {optionRow(content.suitedOptions, suitedIdx, setSuitedIdx)}

          <Text style={styles.sheetSection}>{t('search.filterCategory')}</Text>
          {optionRow(content.searchFilters.slice(1), categoryIndex === 0 ? null : categoryIndex - 1, i => setCategoryIndex(i === null ? 0 : i + 1))}

          <PrimaryBtn label={t('search.apply')} onPress={() => setSheetOpen(false)} style={styles.sheetApply} />
          <Pressable onPress={clearFilters} style={styles.sheetClear}>
            <Text style={styles.sheetClearLabel}>{t('search.clearFilters')}</Text>
          </Pressable>
        </View>
      </Modal>
    </Atmosphere>
  )
}
