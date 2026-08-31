import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  areaLabel,
  formatDistance,
  formatMinuteOfDay,
  placePriceParts,
  useSavedPlaces,
  useToggleSaved,
  type PlaceCard as PlaceCardModel,
} from '@/shared/api'
import { isStandalonePrice, priceUnitKey } from '@/shared/pricing/price-unit'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState } from '@/shared/ui/async-state.view'
import { MapCanvas, type MapPin } from '@/shared/ui/map-canvas.view'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import {
  Atmosphere,
  Chip,
  GhostBtn,
  GlassCard,
  IconBtn,
  SecondaryBtn,
  useTabDockInset,
} from '@/shared/ui/primitives'
import { PlaceGridSkeleton } from '@/shared/ui/skeleton.view'
import { hitSlop, spacing } from '@/shared/ui/tokens'

import { styles } from './saved.style'

type ViewMode = 'list' | 'map'
type SavedFilter = 'all' | 'places' | 'plans'

const FILTERS: readonly SavedFilter[] = ['all', 'places', 'plans']

/** Saved places that carry coordinates, as pins for the map adapter. */
function toPins(places: PlaceCardModel[]): MapPin[] {
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

  function openPlace(place: PlaceCardModel) {
    router.push(`/places/${place.id}`)
  }

  function hoursLabel(place: PlaceCardModel): string {
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
          <IconBtn
            onPress={() => router.push('/places/import')}
            accessibilityLabel={t('saved.addPlace')}
            style={styles.addPlaceBtn}
          >
            <Text style={styles.addPlaceLabel}>＋</Text>
          </IconBtn>
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
            <Chip
              key={option}
              label={t(`saved.filter.${option}`)}
              variant={filter === option ? 'selected' : 'default'}
              onPress={() => setFilter(option)}
            />
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
        <View style={[styles.grid, { paddingHorizontal: spacing[5], paddingTop: spacing[2] }]}>
          {[0, 1, 2, 3].map(index => (
            <View key={index} style={{ width: '48%' }}>
              <PlaceGridSkeleton />
            </View>
          ))}
        </View>
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
              <PlaceCard
                key={place.id}
                place={place}
                variant="grid"
                onPress={() => openPlace(place)}
                // Everything in this list is already saved, so the only action
                // the bookmark offers is removal.
                saved
                onToggleSave={() => toggleSaved.mutate({ type: 'place', id: place.id, saved: true })}
                style={{ width: '48%' }}
              />
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
                {/* The price never leaves its unit behind (spec §5). */}
                {(() => {
                  const { amount, unit } = placePriceParts(selected)
                  if (isStandalonePrice(unit)) {
                    return <Text style={styles.sheetMeta} numberOfLines={1}>{t(priceUnitKey(unit))}</Text>
                  }
                  return amount ? (
                    <Text style={styles.sheetMeta} numberOfLines={1}>
                      {amount}
                      {t(priceUnitKey(unit))}
                    </Text>
                  ) : null
                })()}
                <View style={styles.sheetActions}>
                  <SecondaryBtn
                    label={t('common.details')}
                    onPress={() => openPlace(selected)}
                    style={styles.sheetBtn}
                  />
                </View>
              </View>
            </GlassCard>
          ) : null}
        </View>
      )}
    </Atmosphere>
  )
}
