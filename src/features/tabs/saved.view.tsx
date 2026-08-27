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
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, GhostBtn, GlassCard, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './saved.style'

type ViewMode = 'list' | 'map'
type SavedFilter = 'all' | 'places' | 'plans'

const FILTERS: readonly SavedFilter[] = ['all', 'places', 'plans']

/**
 * Marker layout until the native map adapter lands (a map SDK needs its own
 * ADR). Positions are projected from real coordinates, so the *relative*
 * geometry is true even though there is no basemap — unlike fixed percentages,
 * which put places wherever the array order happened to fall.
 */
function projectMarkers(places: PlaceCard[]): { place: PlaceCard; left: `${number}%`; top: `${number}%` }[] {
  const located = places.filter(place => place.lat != null && place.lng != null)
  if (located.length === 0) return []

  const lats = located.map(place => place.lat as number)
  const lngs = located.map(place => place.lng as number)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  // A single place, or a set sharing a coordinate, has no spread to normalise.
  const latSpan = maxLat - minLat || 1
  const lngSpan = maxLng - minLng || 1

  return located.map(place => {
    const left = 15 + (((place.lng as number) - minLng) / lngSpan) * 70
    // Latitude grows northward, screen y grows downward.
    const top = 15 + (1 - ((place.lat as number) - minLat) / latSpan) * 70
    return { place, left: `${left}%` as const, top: `${top}%` as const }
  })
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
  const markers = useMemo(() => projectMarkers(places), [places])
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
            style={styles.addPlaceBtn}
          >
            <Text style={styles.addPlaceLabel}>＋</Text>
          </Pressable>
          {/* List/Map toggle — filters survive the switch */}
          <View style={styles.toggle}>
            {(['list', 'map'] as ViewMode[]).map(mode => (
              <Pressable key={mode} onPress={() => setView(mode)} style={[styles.toggleBtn, view === mode && styles.toggleBtnActive]}>
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
              <Pressable key={place.id} onPress={() => openPlace(place)} style={{ width: '48%' }}>
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
          <View style={styles.mapCanvas} />

          {markers.map(({ place, left, top }) => {
            const isSelected = (selected?.id ?? '') === place.id
            return (
              <Pressable
                key={place.id}
                onPress={() => setSelectedId(place.id)}
                accessibilityLabel={`${place.name}${place.openNow ? '' : ` — ${t('common.closed')}`}`}
                style={[
                  styles.marker,
                  { left, top },
                  isSelected && styles.markerSelected,
                  !place.openNow && !isSelected && styles.markerClosed,
                ]}
              >
                <Text style={isSelected ? styles.markerPrice : styles.markerEmoji}>
                  {isSelected ? (placePriceLabel(place) ?? '·') : '📍'}
                </Text>
              </Pressable>
            )
          })}

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
                  <Pressable onPress={() => openPlace(selected)} style={styles.sheetBtn}>
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
