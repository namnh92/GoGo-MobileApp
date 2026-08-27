import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  areaLabel,
  formatDistance,
  placePriceLabel,
  toPlaceCard,
  useMe,
  usePlaceSearch,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore, type QuickPreset } from '@/shared/store/roomStore'
import { IconClock } from '@/shared/ui/icons'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, AvatarCircle, GlassCard, TagChip, useTabDockInset } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './home.style'

const { brand, neutral } = colors

const PRESET_KEYS: QuickPreset[] = ['tonight', 'weekend', 'special']
const RAIL_SIZE = 5

export default function HomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { uiState, setUiState, quickPreset, setQuickPreset } = useRoom()
  const dockInset = useTabDockInset()

  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' || status === 'guest' })

  // The wizard's area pick is the only origin available without a location
  // permission; without it the rail is ranked by curation rather than distance.
  const originLat = useRoomStore(state => state.originLat)
  const originLng = useRoomStore(state => state.originLng)
  const hasOrigin = originLat != null && originLng != null

  const search = usePlaceSearch({
    sort: 'curated',
    limit: RAIL_SIZE,
    ...(hasOrigin ? { lat: originLat as number, lng: originLng as number } : {}),
  })

  const places = useMemo(
    () => (search.data?.pages ?? []).flatMap(page => page.results.map(toPlaceCard)).slice(0, RAIL_SIZE),
    [search.data],
  )

  function startCreate() {
    track('date_create_started', { preset: quickPreset })
    router.push('/create/type')
  }

  /**
   * State comes from the query. The dev-only selector in Profile can still
   * force a branch on top, which is what makes the state matrix reviewable.
   */
  const realState = search.isPending
    ? 'loading'
    : search.isError
      ? 'error'
      : places.length === 0
        ? 'empty'
        : 'default'
  const visualState = uiState === 'default' ? realState : uiState

  const initial = (me.data?.displayName ?? '').trim().charAt(0).toUpperCase()

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing[3], paddingBottom: dockInset }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('home.greeting')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button">
            <AvatarCircle label={initial || '·'} />
          </Pressable>
        </View>

        {/* Search entry — full discovery lives at /places/search */}
        <Pressable
          onPress={() => router.push('/places/search')}
          accessibilityRole="search"
          style={styles.searchBar}
        >
          <Text style={styles.searchBarLabel}>🔍  {t('search.placeholder')}</Text>
        </Pressable>

        {/* Brand surface rather than a stock photo of somewhere GoGo has no
            relationship with (GoGo-BE#151). */}
        <View style={styles.hero}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: brand.coralDeep }]} />
          <View style={styles.heroScrim} />
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>🌙 {t('home.heroBadge')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
            <Text style={styles.heroBody}>{t('home.heroBody')}</Text>
            <View style={styles.heroActions}>
              <Pressable
                onPress={startCreate}
                style={({ pressed }) => [styles.heroBtn, { backgroundColor: brand.coral }, pressed && { transform: [{ scale: 0.98 }] }]}
              >
                <Text style={styles.heroBtnLabel}>{t('home.createDate')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/places/search')}
                style={({ pressed }) => [styles.heroBtn, { backgroundColor: brand.lavenderGlass }, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.heroBtnLabel}>{t('home.quickPick')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Quick presets — context filter for the next room, not a create action */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing[5] }}
          contentContainerStyle={{ paddingHorizontal: spacing[5], gap: spacing[3] }}
        >
          {content.quickPresets.map((preset, index) => {
            const key = PRESET_KEYS[index]
            const active = quickPreset === key
            return (
              <Pressable
                key={preset.label}
                onPress={() => setQuickPreset(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.preset, active ? { backgroundColor: brand.coral } : styles.presetGlass]}
              >
                <Text style={[styles.presetLabel, { color: active ? neutral[0] : neutral[500] }]}>
                  {preset.emoji} {preset.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[6] }}>
          <Text style={styles.sectionTitle}>{t('home.suggested')}</Text>

          {visualState === 'loading' && (
            <View style={{ gap: spacing[3] }}>
              {[0, 1, 2].map(index => (
                <GlassCard key={index} style={styles.skeletonCard}>
                  <View style={styles.skeletonThumb} />
                  <View style={{ flex: 1, padding: spacing[3], gap: spacing[2] }}>
                    <View style={[styles.skeletonLine, { width: '66%' }]} />
                    <View style={[styles.skeletonLine, { width: '50%' }]} />
                    <View style={[styles.skeletonLine, { width: '33%' }]} />
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {visualState === 'empty' && (
            <GlassCard style={styles.stateCard}>
              <Text style={styles.stateEmoji}>🗺️</Text>
              <Text style={styles.stateTitle}>{t('home.emptyTitle')}</Text>
              <Text style={styles.stateBody}>{t('home.emptyBody')}</Text>
              <View style={{ gap: spacing[2], alignSelf: 'stretch', marginTop: spacing[4] }}>
                <Pressable onPress={() => router.push('/places/search')} style={styles.recoverBtn}>
                  <Text style={styles.recoverLabel}>{t('home.recoverNearest')}</Text>
                </Pressable>
                <Pressable onPress={startCreate} style={styles.recoverBtn}>
                  <Text style={styles.recoverLabel}>{t('home.createManual')}</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}

          {visualState === 'error' && (
            <GlassCard style={styles.stateCard}>
              <Text style={styles.stateEmoji}>📡</Text>
              <Text style={styles.stateTitle}>{t('home.error')}</Text>
              <Text style={styles.stateBody}>{t('home.errorBody')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
                <Pressable
                  onPress={() => {
                    setUiState('default')
                    void search.refetch()
                  }}
                  style={[styles.recoverBtn, { backgroundColor: brand.coral, paddingHorizontal: spacing[5] }]}
                >
                  <Text style={[styles.recoverLabel, { color: neutral[0] }]}>{t('home.retry')}</Text>
                </Pressable>
                <Pressable onPress={startCreate} style={[styles.recoverBtn, styles.recoverOutline]}>
                  <Text style={styles.recoverLabel}>{t('home.createManual')}</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}

          {visualState === 'default' && (
            <View style={{ gap: spacing[3] }}>
              {places.map(place => (
                <Pressable key={place.id} onPress={() => router.push(`/places/${place.id}`)}>
                  <GlassCard style={styles.planCard}>
                    <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={styles.planThumb} />
                    <View style={{ flex: 1, padding: spacing[3] }}>
                      <Text style={styles.planTitle} numberOfLines={1}>{place.name}</Text>
                      {/* Only rendered when there is something real to say — a
                          placeholder here would be noise, not information. */}
                      {[areaLabel(place), formatDistance(place.distanceM)].filter(Boolean).length > 0 ? (
                        <View style={styles.planMeta}>
                          <IconClock />
                          <Text style={styles.planMetaLabel} numberOfLines={1}>
                            {[areaLabel(place), formatDistance(place.distanceM)].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.planTags}>
                        {place.reasonCodes.slice(0, 2).map(code => (
                          <TagChip key={code} label={t(`search.reason.${code}`, { defaultValue: code })} />
                        ))}
                        {placePriceLabel(place) ? (
                          <Text style={styles.planBudget}>~{placePriceLabel(place)}</Text>
                        ) : null}
                      </View>
                    </View>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
