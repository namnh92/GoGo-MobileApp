import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEMO_PLAN_ID, savedPlaces, unsplashUrl } from '@/data/mockData'
import { useSavedPlaces } from '@/shared/api/mock'
import { usePriceFormatter } from '@/shared/pricing'
import { useLocaleContent } from '@/shared/i18n'
import { Atmosphere, GlassCard, RemoteImage, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'
import { styles } from './saved.style'

type ViewMode = 'list' | 'map'

// Mock marker positions (percent of map area) — a real map SDK replaces this.
const markerPositions = [
  { left: '30%', top: '32%' },
  { left: '58%', top: '48%' },
  { left: '44%', top: '68%' },
  { left: '72%', top: '26%' },
] as const

export default function SavedScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { stopPrice } = usePriceFormatter()
  const query = useSavedPlaces()
  const [filterIndex, setFilterIndex] = useState(0)
  const [view, setView] = useState<ViewMode>('list')
  const [selectedPlace, setSelectedPlace] = useState(0)
  const [savedIdx, setSavedIdx] = useState<number[]>([0, 1, 2, 3])
  const places = query.data ?? savedPlaces
  const selected = places[selectedPlace]
  const dockInset = useTabDockInset()

  return (
    <Atmosphere>
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('saved.title')}</Text>
          {/* List/Map toggle — filters survive the switch */}
          <View style={styles.toggle}>
            {(['list', 'map'] as ViewMode[]).map(m => (
              <Pressable key={m} onPress={() => setView(m)} style={[styles.toggleBtn, view === m && styles.toggleBtnActive]}>
                <Text style={[styles.toggleLabel, view === m && styles.toggleLabelActive]}>
                  {t(m === 'list' ? 'saved.list' : 'saved.map')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {content.savedFilters.map((f, i) => (
            <Pressable key={f} onPress={() => setFilterIndex(i)} style={[styles.filterBtn, filterIndex === i && styles.filterBtnActive]}>
              <Text style={[styles.filterLabel, filterIndex === i && styles.filterLabelActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {view === 'list' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: dockInset }}>
          <View style={styles.grid}>
            {places.map(item => (
              <Pressable key={item.title} onPress={() => router.push('/places/sakura-omakase')} style={{ width: '48%' }}>
                <GlassCard style={[styles.gridCard, { width: '100%' }]}>
                  <View style={styles.gridThumbWrap}>
                    <RemoteImage uri={unsplashUrl(item.img, 300, 240)} style={StyleSheet.absoluteFill} />
                    <View style={styles.score}>
                      <Text style={styles.scoreLabel}>♥ {item.score}</Text>
                    </View>
                  </View>
                  <View style={{ padding: spacing[3] }}>
                    <Text style={styles.gridTitle}>{item.title}</Text>
                    <Text style={styles.gridMeta}>{item.area} · {stopPrice(item.priceK)}</Text>
                    <View style={{ flexDirection: 'row', marginTop: 6 }}>
                      <TagChip label={item.tags[0]} />
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.mapRoot}>
          {/* Mock map canvas */}
          <View style={styles.mapCanvas}>
            <View style={[styles.road, { left: '15%', top: 0, bottom: 0, width: 8, transform: [{ rotate: '12deg' }] }]} />
            <View style={[styles.road, { left: '55%', top: 0, bottom: 0, width: 12, transform: [{ rotate: '-6deg' }] }]} />
            <View style={[styles.road, { top: '42%', left: 0, right: 0, height: 8, transform: [{ rotate: '2deg' }] }]} />
          </View>

          {places.map((p, i) => {
            const isSelected = selectedPlace === i
            return (
              <Pressable
                key={p.title}
                onPress={() => setSelectedPlace(i)}
                accessibilityLabel={`${p.title}${p.open ? '' : ` — ${t('common.closed')}`}`}
                style={[styles.marker, markerPositions[i], isSelected && styles.markerSelected, !p.open && !isSelected && styles.markerClosed]}
              >
                <Text style={isSelected ? styles.markerPrice : styles.markerEmoji}>
                  {isSelected ? `${p.priceK}k` : p.category}
                </Text>
              </Pressable>
            )
          })}

          <Pressable style={styles.searchArea}>
            <Text style={styles.searchAreaLabel}>{t('saved.searchArea')}</Text>
          </Pressable>

          {/* Bottom sheet: marker ↔ card selection stays in sync */}
          <GlassCard strong style={[styles.sheet, { bottom: dockInset }]}>
            <RemoteImage uri={unsplashUrl(selected.img, 200, 200)} style={styles.sheetThumb} />
            <View style={{ flex: 1, padding: spacing[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>{selected.title}</Text>
                <Pressable
                  onPress={() => setSavedIdx(prev => (prev.includes(selectedPlace) ? prev.filter(x => x !== selectedPlace) : [...prev, selectedPlace]))}
                  accessibilityLabel={t('placeDetail.save')}
                >
                  <Text style={{ fontSize: 15 }}>{savedIdx.includes(selectedPlace) ? '🔖' : '📑'}</Text>
                </Pressable>
              </View>
              <Text>
                <Text style={selected.open ? styles.sheetStatusOpen : styles.sheetStatusClosed}>
                  {t(selected.open ? 'common.open' : 'common.closed')}
                </Text>
                <Text style={styles.sheetMeta}> · {selected.area} · {selected.distanceKm} km</Text>
              </Text>
              <Text style={styles.sheetMeta} numberOfLines={1}>{stopPrice(selected.priceK)}</Text>
              <View style={styles.sheetActions}>
                <Pressable onPress={() => router.push('/places/sakura-omakase')} style={styles.sheetBtn}>
                  <Text style={styles.sheetBtnLabel} numberOfLines={1}>{t('common.details')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/plans/${DEMO_PLAN_ID}`)}
                  disabled={!selected.open}
                  style={[styles.sheetBtn, styles.sheetBtnGrow, selected.open ? styles.sheetAddBtn : styles.sheetAddDisabled]}
                >
                  <Text style={selected.open ? styles.sheetAddLabel : styles.sheetAddLabelDisabled} numberOfLines={1}>
                    {t('placeDetail.addToPlan')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>
        </View>
      )}
    </Atmosphere>
  )
}
