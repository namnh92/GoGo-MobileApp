import { DraftResume } from '@/features/create-date/draft-resume.view'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isSaved,
  toPlaceCard,
  useMe,
  usePlaceSearch,
  useSaved,
  useToggleSaved,
  isApiError,
} from '@/shared/api'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { scopeSearchParams, useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore, type QuickPreset } from '@/shared/store/roomStore'
import { haptic } from '@/shared/ui/feedback'
import { IconSearch } from '@/shared/ui/icons'
import { PlaceCard } from '@/shared/ui/place-card.view'
import {
  Atmosphere,
  AvatarCircle,
  Chip,
  GhostBtn,
  GlassCard,
  SecondaryBtn,
  useTabDockInset,
} from '@/shared/ui/primitives'
import { StaleNotice } from '@/shared/ui/async-state.view'
import { PlaceListSkeleton } from '@/shared/ui/skeleton.view'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './home.style'

const { brand } = colors

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

  // Saving needs an account: a guest token gets 403 USER_ONLY.
  const canSave = status === 'user'
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  // ADM-204 (#209): a fresh device position first, else the account's canonical
  // area, else no location — never the create wizard's draft, which is about a
  // room rather than about where the user is. Search waits until the scope is
  // known, so one scope means one request.
  const profileArea = status === 'user' ? me.data?.homeAdministrativeArea : null
  const { scope, recheck } = useDiscoveryScope({
    profileArea,
    profilePending: status === 'hydrating' || (status === 'user' && me.isPending),
  })
  const location = useCurrentLocation()

  const search = usePlaceSearch(
    { sort: 'curated', limit: RAIL_SIZE, ...scopeSearchParams(scope) },
    { enabled: scope.status === 'ready' },
  )

  // What the server says scoped the page, not what was asked: an older server
  // ignores area parameters and reports nothing, and then nothing is claimed.
  const served = search.data?.pages[0]?.meta?.location
  const scopeLabel =
    served?.source === 'gps'
      ? t('home.scopeGps')
      : served?.source === 'administrative_area' && served.area
        ? t('home.scopeArea', {
            area: served.area.communeName
              ? `${served.area.communeName}, ${served.area.provinceName}`
              : served.area.provinceName,
          })
        : null
  const areaVersionChanged =
    isApiError(search.error) && search.error.code === 'ADMINISTRATIVE_VERSION_CHANGED'

  async function requestDeviceLocation() {
    // Asked here, on tap, never on launch.
    const result = await location.request()
    if (result.status === 'granted') await recheck()
  }

  function chooseArea() {
    // The account area lives in account information; a guest needs an account first.
    router.push(status === 'user' ? '/settings/account' : '/auth/sign-in')
  }

  const places = useMemo(
    () => (search.data?.pages ?? []).flatMap(page => page.results.map(toPlaceCard)).slice(0, RAIL_SIZE),
    [search.data],
  )

  function startCreate() {
    useRoomStore.getState().resetDraft()
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
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t('home.greeting')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
            hitSlop={8}
          >
            <AvatarCircle label={initial || '·'} size={44} imageUri={me.data?.avatarUrl} />
          </Pressable>
        </View>

        {/* Suggestions still on screen from an earlier search (GoGo-MobileApp#253). */}
        <StaleNotice
          error={search.isError ? search.error : null}
          hasData={visualState === 'default'}
          onRetry={() => void search.refetch()}
        />

        <DraftResume />

        {/* Search entry — full discovery lives at /places/search */}
        <Pressable
          onPress={() => router.push('/places/search')}
          accessibilityRole="search"
          accessibilityLabel={t('search.placeholder')}
          style={styles.searchBar}
        >
          <IconSearch />
          <Text style={styles.searchBarLabel}>{t('search.placeholder')}</Text>
        </Pressable>

        {/* Brand surface rather than a stock photo of somewhere GoGo has no
            relationship with. */}
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
                accessibilityRole="button"
                onPress={() => {
                  haptic('impact')
                  startCreate()
                }}
                style={({ pressed }) => [styles.heroPrimary, pressed && { transform: [{ scale: 0.98 }] }]}
              >
                <Text style={styles.heroPrimaryLabel}>{t('home.createDate')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptic('select')
                  router.push('/places/search')
                }}
                style={({ pressed }) => [styles.heroSecondary, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.heroSecondaryLabel}>{t('home.quickPick')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Quick presets — context filter for the next room, not a create action */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing[5] }}
          contentContainerStyle={styles.presetRow}
        >
          {content.quickPresets.map((preset, index) => {
            const key = PRESET_KEYS[index]
            return (
              <Chip
                key={preset.label}
                label={preset.label}
                icon={preset.emoji}
                variant={quickPreset === key ? 'selected' : 'default'}
                onPress={() => setQuickPreset(key)}
              />
            )
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[6] }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.suggested')}</Text>
            {visualState === 'default' ? (
              <Text style={styles.sectionHint}>{t('home.suggestedHint')}</Text>
            ) : null}
          </View>

          {scope.status === 'ready' && scope.source === 'none' ? (
            <GlassCard style={styles.scopeCard}>
              <Text style={styles.scopeTitle}>{t('home.scopeNoneTitle')}</Text>
              <Text style={styles.scopeBody}>
                {t(scope.reason === 'area_needs_reselection' ? 'home.scopeReselectBody' : 'home.scopeNoneBody')}
              </Text>
              {location.state.status === 'denied' || location.state.status === 'unavailable' ? (
                <Text accessibilityLiveRegion="polite" style={styles.scopeBody}>
                  {t(location.state.status === 'denied' ? 'home.locationDenied' : 'home.locationUnavailable')}
                </Text>
              ) : null}
              <View style={styles.stateActions}>
                <SecondaryBtn
                  label={t('home.useLocation')}
                  onPress={() => void requestDeviceLocation()}
                  loading={location.state.status === 'asking'}
                />
                <GhostBtn label={t('home.chooseArea')} onPress={chooseArea} />
              </View>
            </GlassCard>
          ) : scopeLabel ? (
            <Text accessibilityLiveRegion="polite" style={styles.scopeLabel}>
              {scopeLabel}
            </Text>
          ) : null}

          {/* A skeleton in the shape of the list, not a spinner (spec §30). */}
          {visualState === 'loading' && <PlaceListSkeleton count={3} />}

          {visualState === 'empty' && (
            <GlassCard style={styles.stateCard}>
              <Text style={styles.stateEmoji}>🗺️</Text>
              <Text style={styles.stateTitle}>{t('home.emptyTitle')}</Text>
              <Text style={styles.stateBody}>{t('home.emptyBody')}</Text>
              <View style={styles.stateActions}>
                <SecondaryBtn label={t('home.recoverNearest')} onPress={() => router.push('/places/search')} />
                <GhostBtn label={t('home.createManual')} onPress={startCreate} />
              </View>
            </GlassCard>
          )}

          {visualState === 'error' && (
            <GlassCard style={styles.stateCard}>
              <Text style={styles.stateEmoji}>📡</Text>
              <Text style={styles.stateTitle}>{t('home.error')}</Text>
              <Text style={styles.stateBody}>
                {areaVersionChanged ? t('administrative.changed') : t('home.errorBody')}
              </Text>
              <View style={styles.stateActions}>
                <SecondaryBtn
                  label={t('home.retry')}
                  onPress={() => {
                    setUiState('default')
                    void search.refetch()
                  }}
                />
                {areaVersionChanged ? (
                  <GhostBtn label={t('home.chooseArea')} onPress={chooseArea} />
                ) : (
                  <GhostBtn label={t('home.createManual')} onPress={startCreate} />
                )}
              </View>
            </GlassCard>
          )}

          {visualState === 'default' && (
            <View style={{ gap: spacing[3] }}>
              {places.map(place => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  onPress={() => router.push(`/places/${place.id}`)}
                  tags={place.reasonCodes.map(code => t(`search.reason.${code}`, { defaultValue: code }))}
                  saved={canSave ? isSaved(saved.data, 'place', place.id) : undefined}
                  onToggleSave={
                    canSave
                      ? () => {
                          const currentlySaved = isSaved(saved.data, 'place', place.id)
                          toggleSaved.mutate({ type: 'place', id: place.id, saved: currentlySaved })
                          if (!currentlySaved) track('place_saved', { placeId: place.id })
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
