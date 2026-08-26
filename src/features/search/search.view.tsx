import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { unsplashUrl } from '@/data/mockData'
import { SEARCH_STYLE_TAGS } from '@/data/taxonomy'
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
// Index 0 in searchFilters is "All"; groups are keyed by index - 1.
const CATEGORY_EMOJI: string[][] = [
  ['🍣', '🍜', '📍'],
  ['☕'],
  ['🎨'],
  ['🌃'],
  ['🛏'],
]

const SUITED_KEYS = ['couple', 'group'] as const

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function parseNum(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
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
  // Multi-select category group indices (into CATEGORY_EMOJI); empty = all.
  const [selectedCats, setSelectedCats] = useState<number[]>([])
  const [sheetOpen, setSheetOpen] = useState(filters === '1')
  const [maxKm, setMaxKm] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [suitedIdx, setSuitedIdx] = useState<number | null>(null)
  const [styleTags, setStyleTags] = useState<string[]>([])
  const isPicker = picker === '1'

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

  const maxKmNum = parseNum(maxKm)
  const priceFromNum = parseNum(priceFrom)
  const priceToNum = parseNum(priceTo)
  const activeFilterCount =
    (maxKmNum !== null ? 1 : 0) +
    (priceFromNum !== null || priceToNum !== null ? 1 : 0) +
    (suitedIdx !== null ? 1 : 0) +
    (selectedCats.length > 0 ? 1 : 0) +
    (styleTags.length > 0 ? 1 : 0)

  function toggleCat(group: number) {
    setSelectedCats(prev => (prev.includes(group) ? prev.filter(x => x !== group) : [...prev, group]))
  }

  const places = [...importedPlaces, ...(catalog.data ?? [])]
  const needle = normalize(query.trim())
  const filtered = places.filter(p => {
    if (selectedCats.length > 0 && !selectedCats.some(g => CATEGORY_EMOJI[g]?.includes(p.category))) return false
    if (maxKmNum !== null && p.distanceKm > maxKmNum) return false
    if (p.priceK > 0 && (priceFromNum !== null || priceToNum !== null)) {
      const per = p.priceK / 2
      if (priceFromNum !== null && per < priceFromNum) return false
      if (priceToNum !== null && per > priceToNum) return false
    }
    if (suitedIdx !== null && p.suitedFor && !p.suitedFor.includes(SUITED_KEYS[suitedIdx])) return false
    if (styleTags.length > 0 && !styleTags.some(tag => p.tags.includes(tag))) return false
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
    setStyleTags([])
    setSelectedCats([])
    setMaxKm('')
    setPriceFrom('')
    setPriceTo('')
    setSuitedIdx(null)
  }

  const categoryLabels = content.searchFilters.slice(1)

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

      {/* Multi-select category chips — "Tất cả" clears the set */}
      <View style={styles.filterRow}>
        <Pressable onPress={() => setSelectedCats([])} style={[styles.filterBtn, selectedCats.length === 0 && styles.filterBtnActive]}>
          <Text style={[styles.filterLabel, selectedCats.length === 0 && styles.filterLabelActive]}>{content.searchFilters[0]}</Text>
        </Pressable>
        {categoryLabels.map((label, g) => {
          const active = selectedCats.includes(g)
          return (
            <Pressable key={label} onPress={() => toggleCat(g)} accessibilityState={{ selected: active }} style={[styles.filterBtn, active && styles.filterBtnActive]}>
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[1], paddingBottom: insets.bottom + 96 }}>
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
          </View>
        )}
      </ScrollView>

      {/* Floating add-place button — always available (SRS FR-PLACE-001) */}
      <Pressable
        onPress={() => router.push('/places/import')}
        accessibilityRole="button"
        accessibilityLabel={t('search.addNew')}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing[5] }, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

      {/* Multi-criteria filter sheet */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
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
          <TextInput
            value={maxKm}
            onChangeText={setMaxKm}
            placeholder={t('search.distancePlaceholder')}
            placeholderTextColor={colors.neutral[300]}
            keyboardType="numeric"
            style={styles.sheetInput}
          />

          <Text style={styles.sheetSection}>{t('search.filterPrice')}</Text>
          <View style={styles.priceRow}>
            <TextInput
              value={priceFrom}
              onChangeText={setPriceFrom}
              placeholder={t('search.priceFrom')}
              placeholderTextColor={colors.neutral[300]}
              keyboardType="numeric"
              style={[styles.sheetInput, styles.priceInput]}
            />
            <Text style={styles.priceDash}>–</Text>
            <TextInput
              value={priceTo}
              onChangeText={setPriceTo}
              placeholder={t('search.priceTo')}
              placeholderTextColor={colors.neutral[300]}
              keyboardType="numeric"
              style={[styles.sheetInput, styles.priceInput]}
            />
          </View>

          <Text style={styles.sheetSection}>{t('search.filterSuited')}</Text>
          <View style={styles.sheetOptionRow}>
            {content.suitedOptions.map((label, i) => {
              const active = suitedIdx === i
              return (
                <Pressable
                  key={label}
                  onPress={() => setSuitedIdx(active ? null : i)}
                  accessibilityState={{ selected: active }}
                  style={[styles.sheetOption, active && styles.sheetOptionActive]}
                >
                  <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>{label}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.sheetSection}>{t('search.filterStyle')}</Text>
          <View style={styles.sheetOptionRow}>
            {SEARCH_STYLE_TAGS.map(tag => {
              const active = styleTags.includes(tag)
              return (
                <Pressable
                  key={tag}
                  onPress={() => setStyleTags(prev => (prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))}
                  accessibilityState={{ selected: active }}
                  style={[styles.sheetOption, active && styles.sheetOptionActive]}
                >
                  <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>
                    {content.tagLabels[tag] ?? tag}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.sheetSection}>{t('search.filterCategory')}</Text>
          <View style={styles.sheetOptionRow}>
            {categoryLabels.map((label, g) => {
              const active = selectedCats.includes(g)
              return (
                <Pressable
                  key={label}
                  onPress={() => toggleCat(g)}
                  accessibilityState={{ selected: active }}
                  style={[styles.sheetOption, active && styles.sheetOptionActive]}
                >
                  <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>{label}</Text>
                </Pressable>
              )
            })}
          </View>

          <PrimaryBtn label={t('search.apply')} onPress={() => setSheetOpen(false)} style={styles.sheetApply} />
          <Pressable onPress={clearFilters} style={styles.sheetClear}>
            <Text style={styles.sheetClearLabel}>{t('search.clearFilters')}</Text>
          </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </Atmosphere>
  )
}
