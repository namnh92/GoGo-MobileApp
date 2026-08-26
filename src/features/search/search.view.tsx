import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
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
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export default function SearchScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { picker, q } = useLocalSearchParams<{ picker?: string; q?: string }>()
  const { stopPrice } = usePriceFormatter()
  const catalog = useCatalogPlaces()
  const importedPlaces = useImportStore(s => s.importedPlaces)
  const bookmarked = useBookmarkStore(s => s.bookmarked)
  const toggleBookmark = useBookmarkStore(s => s.toggleBookmark)
  const addSeedPlace = useRoom().addSeedPlace
  const [query, setQuery] = useState(q ?? '')
  const [filterIndex, setFilterIndex] = useState(0)
  const isPicker = picker === '1'

  useEffect(() => {
    track('place_search_opened', { picker: isPicker })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const places = [...importedPlaces, ...(catalog.data ?? [])]
  const needle = normalize(query.trim())
  const filtered = places.filter(p => {
    if (filterIndex > 0 && !FILTER_EMOJI[filterIndex]?.includes(p.category)) return false
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
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {content.searchFilters.map((label, i) => (
          <Pressable key={label} onPress={() => setFilterIndex(i)} style={[styles.filterBtn, filterIndex === i && styles.filterBtnActive]}>
            <Text style={[styles.filterLabel, filterIndex === i && styles.filterLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}>
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
                <Text style={styles.meta}>
                  <Text style={place.open ? styles.statusOpen : styles.statusClosed}>
                    {t(place.open ? 'common.open' : 'common.closed')}
                  </Text>
                  {'  ·  '}{place.area}{place.priceK > 0 ? `  ·  ${stopPrice(place.priceK)}` : ''}
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
    </Atmosphere>
  )
}
