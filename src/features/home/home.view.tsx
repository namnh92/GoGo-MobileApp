import { LocationRow } from '@/shared/ui/location-row.view'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { AppHeader, AppHeaderAction } from '@/shared/ui/app-header.view'
import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { useUnreadInbox } from '@/features/notifications/unread-count'
import { DraftResume } from '@/features/create-date/draft-resume.view'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useUnistyles } from 'react-native-unistyles'
import { QuickJoin } from './quick-join.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'

import {
  isSaved,
  toPlaceCard,
  useMe,
  useHomeRoom,
  useTaxonomies,
  discoveryLabels,
  usePlaceSearch,
  useSaved,
  useToggleSaved,
  isApiError,
} from '@/shared/api'
import { useCurrentLocation } from '@/shared/location/use-current-location'
import { scopeSearchParams, useDiscoveryScope } from '@/shared/location/use-discovery-scope'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { Icon } from '@/shared/ui/icons'
import { PlaceCardLarge } from '@/shared/ui/place-card-large.view'
import { Atmosphere, Card, Chip, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { StaleNotice, useOfflineAnnouncement } from '@/shared/ui/async-state.view'
import { PlaceListSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './home.style'
import { roomBanner } from './room-banner'
import { DiscoveryLocationSheet } from '@/features/search/discovery-location.view'
import { useAppAreaStore } from '@/shared/location/app-area'
import { administrativeAreaLabel } from '@/shared/administrative/snapshot'


const RAIL_SIZE = 5

export default function HomeScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { theme } = useUnistyles()
  const { uiState, setUiState, quickPreset } = useRoom()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('home')

  const { status } = useSession()
  const me = useMe({ enabled: status === 'user' || status === 'guest' })

  // Saving needs an account: a guest token gets 403 USER_ONLY.
  const canSave = status === 'user'
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  const [locationOpen, setLocationOpen] = useState(false)
  const area = useAppAreaStore(state => state.area)
  const { scope, retry: retryScope } = useDiscoveryScope()
  const location = useCurrentLocation()
  const [moods, setMoods] = useState<string[]>([])
  const taxonomies = useTaxonomies({ kinds: 'category,mood,setting,amenity' })
  const labels = useMemo(() => discoveryLabels(taxonomies.data, i18n.language), [taxonomies.data, i18n.language])
  const nearest = useHomeRoom(status === 'user' || status === 'guest')
  const homeRoom = nearest.data?.items[0]
  // Terminal rooms cannot supply a live outing banner.
  const showRoom = homeRoom && !['completed', 'cancelled', 'expired'].includes(homeRoom.status)
  const banner = homeRoom ? roomBanner(homeRoom) : null
  const roomTitle = homeRoom?.title?.trim() || (homeRoom?.type === 'group'
    ? t('discovery.groupRoomTitle', { count: homeRoom.participantCount })
    : t('discovery.coupleRoomTitle'))
  // Taxonomy is the deployed mood-filter signal; active keys always stay removable.
  const moodOptions = { ...labels.mood, ...Object.fromEntries(moods.filter(key => !labels.mood?.[key]).map((key, index) => [key, t('discovery.selectedMood', { number: index + 1 })])) }


  const search = usePlaceSearch(
    { limit: RAIL_SIZE, ...scopeSearchParams(scope), includeTotal: true, locale: i18n.language.startsWith('en') ? 'en' : 'vi', ...(moods.length ? { moods: moods.join(',') } : {}) },
    { enabled: scope.status === 'ready' },
  )

  const unread = useUnreadInbox()
  const [refreshing, setRefreshing] = useState(false)
  const refreshInFlight = useRef(false)
  async function refreshHome() {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    setRefreshing(true)
    try {
      await Promise.allSettled([
        ...(scope.status === 'ready' ? [search.refetch()] : []),
        ...(status === 'user' || status === 'guest' ? [nearest.refetch()] : []),
        ...(status === 'user' ? [unread.refetch()] : []),
      ])
    } finally {
      refreshInFlight.current = false
      setRefreshing(false)
    }
  }

  const scopeLabel = area ? administrativeAreaLabel(area) : null
  const areaVersionChanged =
    isApiError(search.error) && search.error.code === 'ADMINISTRATIVE_VERSION_CHANGED'
  const waitingForNetwork = useWaitingForNetwork(search)

  async function requestDeviceLocation() {
    // Asked here, on tap, never on launch.
    await location.request()
  }

  function chooseArea() {
    setLocationOpen(true)
  }

  const places = useMemo(
    () => (search.data?.pages[0]?.results ?? []).slice(0, RAIL_SIZE).map(result => toPlaceCard(result, labels)),
    [search.data, labels],
  )

  function startCreate() {
    useRoomStore.getState().resetDraft()
    track('date_create_started', { preset: quickPreset })
    router.push('/create/type')
  }

  /**
   * State comes from the query. The dev-only selector in Profile can still
   * force a branch on top, which is what makes the state matrix reviewable.
   *
   * GoGo-MobileApp#253: a failed refresh keeps the suggestions already on screen
   * and lets the stale notice say so (APP-007) — only an area from a replaced
   * dataset still needs the error card, since those results no longer apply.
   * Nothing cached while offline is its own state, not an endless skeleton.
   */
  const realState = scope.status === 'unavailable' ? scope.offline ? 'offline' : 'error' : search.isPending
    ? waitingForNetwork
      ? 'offline'
      : 'loading'
    : search.isError && (places.length === 0 || areaVersionChanged)
      ? 'error'
      : places.length === 0
        ? 'empty'
        : 'default'
  const visualState = uiState === 'default' ? realState : uiState
  const offlineCard = visualState === 'offline'
  useOfflineAnnouncement(offlineCard, t('common.offlineBody'))

  return (
    <Atmosphere redesign>
      <AppHeader variant="tab-root" title={t('discovery.home')} testID="home-header" bellTestID="home-bell" unreadDotTestID="home-unread-dot"
        rightAction={<AppHeaderAction onPress={() => router.push('/places/search')} accessibilityLabel={t('search.title')}><MaterialIcon name="search" size={22} /></AppHeaderAction>} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PullToRefresh refreshing={refreshing} onRefresh={refreshHome}><ScrollView
        testID="home-list"
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => Keyboard.dismiss()}
        onScroll={fab.onScroll}
        scrollEventThrottle={fab.scrollEventThrottle}
        contentContainerStyle={{ paddingBottom: fab.bottomInset }}
      >
        <View style={styles.intro}>
          <View style={{ flex: 1 }}>
            <LocationRow testID="home-location" label={scopeLabel} onPress={chooseArea} />
            <Text variant="discoveryHeading">{me.data?.displayName?.trim() ? t('discovery.greetingName', { name: me.data.displayName.trim() }) : t('discovery.greeting')}</Text>
          </View>
        </View>

        {/* Suggestions still on screen from an earlier search (GoGo-MobileApp#253). */}
        <StaleNotice
          error={search.isError ? search.error : null}
          hasData={visualState === 'default'}
          onRetry={() => void search.refetch()}
        />

        <DraftResume />

        <LinearGradient colors={[theme.accent.gradientStart, theme.accent.gradientMiddle, theme.status.infoGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View pointerEvents="none" style={styles.heroDecor}><MaterialIcon name="groups" size={140} color="accent.text" /></View>
          <Chip label={t('discovery.heroBadge')} icon="zap" />
          <Text variant="discoveryTitle">{t('discovery.heroTitle')}</Text>
          <Text variant="introSmall" color="text.secondary" style={styles.heroBody}>{t('discovery.heroBody')}</Text>
          <Pressable accessibilityRole="button" onPress={startCreate} style={styles.heroPrimary}>
            <MaterialIcon name="plus" color="accent.onAccent" /><Text variant="introLabel" color="accent.onAccent">{t('discovery.createRoom')}</Text>
          </Pressable>
        </LinearGradient>
        <QuickJoin knownName={me.data?.displayName} />
        {showRoom && banner ? <Pressable testID="home-room-banner" accessibilityRole="button" accessibilityLabel={`${t(banner.status)}. ${roomTitle}. ${t(banner.secondary)}. ${t(banner.cta)}`} style={styles.nearestRoom} onPress={() => router.push(banner.destination)}>
          <View style={styles.roomIcon}><MaterialIcon name="groups" color="status.infoText" size={20} /></View>
          <View style={styles.roomCopy}>
            <View style={styles.roomStatus}><View style={styles.roomDot} /><Text variant="introCaptionMedium" color="status.infoText">{t(banner.status)}</Text></View>
            <Text variant="discoveryHeader">{roomTitle}</Text>
            <Text variant="introCaption" color="text.secondary">{t(banner.secondary)}</Text>
          </View>
          <View style={styles.roomAction}><Text variant="introCaptionMedium" color="text.inverse">{t(banner.cta)}</Text></View>
        </Pressable> : null}
        <View testID="home-suggestions" style={styles.suggestions}>
          <View style={styles.sectionHeader}>
            <Text variant="discoveryTitle">{t('discovery.suggested')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('discovery.more')} style={styles.moreAction} onPress={() => router.push({ pathname: '/places/search', params: { suggestions: '1', ...(moods.length ? { moods: moods.join(',') } : {}) } })}>
              <Text variant="introSmall" color="accent.text">{t('discovery.more')}</Text>
              <MaterialIcon name="chevronRight" size={16} color="accent.text" />
            </Pressable>
          </View>
          {Object.keys(moodOptions).length ? <ScrollView testID="home-mood-chips" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
            {Object.entries(moodOptions).map(([key, label]) => <Chip appearance="mood" key={key} label={label} variant={moods.includes(key) ? 'selected' : moods.length >= 10 ? 'disabled' : 'default'} onPress={() => setMoods(prev => prev.includes(key) ? prev.filter(value => value !== key) : [...prev, key])} />)}
          </ScrollView> : null}

          {scope.status === 'ready' && scope.source === 'none' ? (
            <Card padded={false} style={styles.scopeCard}>
              <Text variant="title2">{t('home.scopeNoneTitle')}</Text>
              <Text variant="bodySmall" color="text.secondary">
                {t(scope.reason === 'area_needs_reselection' ? 'home.scopeReselectBody' : 'home.scopeNoneBody')}
              </Text>
              {location.state.status === 'denied' || location.state.status === 'unavailable' ? (
                <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">
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
            </Card>
          ) : null}

          {/* A skeleton in the shape of the list, not a spinner (spec §30). */}
          {visualState === 'loading' && <PlaceListSkeleton count={3} />}

          {visualState === 'empty' && (
            <Card padded={false} style={styles.stateCard}>
              <View style={styles.stateIcon}>
                <Icon name="map" size={28} color="text.secondary" />
              </View>
              <Text variant="title2" style={styles.stateTitle}>{t('home.emptyTitle')}</Text>
              <Text variant="bodySmall" color="text.secondary" style={styles.stateBody}>{t('home.emptyBody')}</Text>
              <View style={styles.stateActions}>
                <SecondaryBtn label={t('home.recoverNearest')} onPress={() => router.push('/places/search')} />
                <GhostBtn label={t('home.createManual')} onPress={startCreate} />
              </View>
            </Card>
          )}

          {(visualState === 'error' || offlineCard) && (
            <Card padded={false} style={styles.stateCard}>
              <View style={styles.stateIcon}>
                <Icon name="wifiOff" size={28} color="text.secondary" />
              </View>
              <Text variant="title2" style={styles.stateTitle}>{offlineCard ? t('common.offlineTitle') : t('home.error')}</Text>
              <Text variant="bodySmall" color="text.secondary" style={styles.stateBody} accessibilityLiveRegion={offlineCard ? 'polite' : undefined}>
                {offlineCard
                  ? t('common.offlineBody')
                  : areaVersionChanged
                    ? t('administrative.changed')
                    : t('home.errorBody')}
              </Text>
              <View style={styles.stateActions}>
                {/* Offline a retry would only pause again; the search resumes on reconnect. */}
                {offlineCard ? null : (
                  <SecondaryBtn
                    label={t('home.retry')}
                    onPress={() => {
                      setUiState('default')
                      if (scope.status === 'unavailable') void retryScope()
                      else void search.refetch()
                    }}
                  />
                )}
                {areaVersionChanged ? (
                  <GhostBtn label={t('home.chooseArea')} onPress={chooseArea} />
                ) : (
                  <GhostBtn label={t('home.createManual')} onPress={startCreate} />
                )}
              </View>
            </Card>
          )}

          {visualState === 'default' && (
            <View style={{ gap: spacing[3] }}>
              {places.map(place => (
                <PlaceCardLarge
                  key={place.id}
                  place={place}
                  onPress={() => router.push(`/places/${place.id}`)}
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
      </ScrollView></PullToRefresh>
      </KeyboardAvoidingView>
      <DiscoveryLocationSheet visible={locationOpen} onClose={() => setLocationOpen(false)} onApplied={() => {}} />
    </Atmosphere>
  )
}
