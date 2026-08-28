import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  areaLabel,
  formatDistance,
  formatMinuteOfDay,
  placePriceLabel,
  useSavedPlaces,
  useToggleSaved,
  type PlaceCard,
} from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { MapCanvas, type MapPin } from '@/shared/ui/map-canvas.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, GhostBtn, GlassCard, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { hitSlop, spacing } from '@/shared/ui/tokens'

import { styles } from './saved.style'

type ViewMode = 'list' | 'map'
type SavedFilter = 'all' | 'places' | 'plans'

const FILTERS: readonly SavedFilter[] = ['all', 'places', 'plans']

/** Saved places that carry coordinates, as pins for the map adapter. */
function toPins(places: PlaceCard[]): MapPin[] {
  return places
    .filter(place => place.lat != null && place.lng != null)
    .map(place => ({
      id: place.id,
      lat: place.lat as number,
      lng: place.lng as number,
      title: place.name,
    }))
}

export default function SavedScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  const dockInset = useTabDockInset()

  const canSave = status === 'user'
  const saved = useSavedPlaces({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  const [filter, setFilter] = useState<SavedFilter>('all')
  const [view, setView] = useState<ViewMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const places = useMemo(() => (filter === 'plans' ? [] : saved.places), [filter, saved.places])
  const pins = useMemo(() => toPins(places), [places])
  const selected = places.find(place => place.id === selectedId) ?? places[0]

  function openPlace(place: PlaceCard) {
    router.push(`/places/${place.id}`)
  }

  function hoursLabel(place: PlaceCard): string {
    if (place.openNow) {
      const closes = formatMinuteOfDay(place.closesAtMinute)
      return closes ? t('search.openUntil', { time: closes }) : t('common.open')
    }
    return t('common.closed')
  }

  return (
    <Atmosphere>
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('saved.title')}</Text>
          <Pressable
            onPress={() => router.push('/places/import')}
            accessibilityRole="button"
            accessibilityLabel={t('saved.addPlace')}
            hitSlop={hitSlop}
            style={styles.addPlaceBtn}
          >
            <Text style={styles.addPlaceLabel}>＋</Text>
          </Pressable>
          {/* List/Map toggle — filters survive the switch */}
          <View style={styles.toggle}>
            {(['list', 'map'] as ViewMode[]).map(mode => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                onPress={() => setView(mode)}
                hitSlop={hitSlop}
                style={[styles.toggleBtn, view === mode && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleLabel, view === mode && styles.toggleLabelActive]}>
                  {t(mode === 'list' ? 'saved.list' : 'saved.map')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(option => (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option }}
              style={[styles.filterBtn, filter === option && styles.filterBtnActive]}
            >
              <Text style={[styles.filterLabel, filter === option && styles.filterLabelActive]}>
                {t(`saved.filter.${option}`)}
              </Text>
            </Pressable>
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
      ) : saved.isPending ? (
        <LoadingState />
      ) : saved.isError ? (
        <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
      ) : places.length === 0 ? (
        <EmptyState
          title={t('saved.emptyTitle')}
          body={t('saved.emptyBody')}
          action={<GhostBtn label={t('saved.browse')} onPress={() => router.push('/places/search')} />}
        />
      ) : view === 'list' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: dockInset }}>
          <View style={styles.grid}>
            {places.map(place => (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                onPress={() => openPlace(place)}
                style={{ width: '48%' }}
              >
                <GlassCard style={[styles.gridCard, { width: '100%' }]}>
                  <View style={styles.gridThumbWrap}>
                    <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
                    {place.rating != null ? (
                      <View style={styles.score}>
                        <Text style={styles.scoreLabel}>♥ {place.rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ padding: spacing[3] }}>
                    <Text style={styles.gridTitle} numberOfLines={1}>{place.name}</Text>
                    <Text style={styles.gridMeta} numberOfLines={1}>
                      {[areaLabel(place), placePriceLabel(place)].filter(Boolean).join(' · ')}
                    </Text>
                    {place.reasonCodes[0] ? (
                      <View style={{ flexDirection: 'row', marginTop: 6 }}>
                        <TagChip label={t(`search.reason.${place.reasonCodes[0]}`, { defaultValue: place.reasonCodes[0] })} />
                      </View>
                    ) : null}
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.mapRoot}>
          <MapCanvas
            pins={pins}
            onSelect={setSelectedId}
            style={styles.mapCanvas}
            fallback={
              <View style={styles.mapUnavailable}>
                <Text style={styles.mapUnavailableLabel}>{t('saved.mapUnavailable')}</Text>
                <GhostBtn label={t('saved.list')} onPress={() => setView('list')} />
              </View>
            }
          />

          {selected ? (
            <GlassCard strong style={[styles.sheet, { bottom: dockInset }]}>
              <PlacePhoto placeId={selected.id} name={selected.name} uri={selected.photoUrl} style={styles.sheetThumb} />
              <View style={{ flex: 1, padding: spacing[3] }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] }}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>{selected.name}</Text>
                  {/* Everything in this list is already saved, so the only
                      action the bookmark offers is removal. */}
                  <Pressable
                    onPress={() => toggleSaved.mutate({ type: 'place', id: selected.id, saved: true })}
                    accessibilityRole="togglebutton"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel={t('saved.remove')}
                  >
                    <Text style={{ fontSize: 15 }}>🔖</Text>
                  </Pressable>
                </View>
                <Text style={selected.openNow ? styles.sheetStatusOpen : styles.sheetStatusClosed}>
                  {hoursLabel(selected)}
                </Text>
                <Text style={styles.sheetMeta} numberOfLines={1}>
                  {[areaLabel(selected), formatDistance(selected.distanceM)].filter(Boolean).join(' · ')}
                </Text>
                <Text style={styles.sheetMeta} numberOfLines={1}>{placePriceLabel(selected) ?? ''}</Text>
                <View style={styles.sheetActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openPlace(selected)}
                    hitSlop={hitSlop}
                    style={styles.sheetBtn}
                  >
                    <Text style={styles.sheetBtnLabel} numberOfLines={1}>{t('common.details')}</Text>
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          ) : null}
        </View>
      )}
    </Atmosphere>
  )
}
