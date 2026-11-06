import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { DraftResume } from '@/features/create-date/draft-resume.view'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useUnistyles } from 'react-native-unistyles'
import { QuickJoin } from './quick-join.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
import { useUnreadInbox } from '@/features/notifications/unread-count'
import { useSession } from '@/shared/providers/session-provider'
import { badgeLabel } from '@/shared/ui/count-badge.view'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { Icon } from '@/shared/ui/icons'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { Atmosphere, AvatarCircle, Card, Chip, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { StaleNotice, useOfflineAnnouncement } from '@/shared/ui/async-state.view'
import { PlaceListSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './home.style'


const RAIL_SIZE = 5

export default function HomeScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  const { uiState, setUiState, quickPreset } = useRoom()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('home')

  const { status } = useSession()
  const unread = useUnreadInbox()
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
  const [moods, setMoods] = useState<string[]>([])
  const taxonomies = useTaxonomies({ kinds: 'category,mood,setting,amenity' })
  const labels = useMemo(() => discoveryLabels(taxonomies.data, i18n.language), [taxonomies.data, i18n.language])
  const nearest = useHomeRoom(status === 'user' || status === 'guest')
  const homeRoom = nearest.data?.items[0]
  // New schedule fields prove this is the server selection contract, even if null.
  const showRoom = homeRoom && 'startAt' in homeRoom && 'endAt' in homeRoom && homeRoom.title?.trim()
  const roomStatus = homeRoom?.status === 'active' ? t('plans.status.active') : homeRoom?.status === 'collecting' ? t('plans.status.collecting') : homeRoom?.status === 'matching' ? t('plans.status.matching') : homeRoom?.status === 'ready' ? t('plans.status.ready') : null

  const search = usePlaceSearch(
    { sort: 'curated', limit: RAIL_SIZE, ...scopeSearchParams(scope), includeTotal: true, locale: i18n.language.startsWith('en') ? 'en' : 'vi', ...(moods.length ? { moods: moods.join(',') } : {}) },
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
  const waitingForNetwork = useWaitingForNetwork(search)

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
    () => (search.data?.pages ?? []).flatMap(page => page.results.map(result => toPlaceCard(result, labels))).slice(0, RAIL_SIZE),
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
  const realState = search.isPending
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

  const initial = (me.data?.displayName ?? '').trim().charAt(0).toUpperCase()

  return (
    <Atmosphere redesign>
      <View style={[styles.topBar, { paddingTop: insets.top, minHeight: insets.top + 64 }]}>
        <View style={styles.brand}><MaterialIcon name="explore" color="redesign.white" size={19} /></View>
        <Text variant="discoveryHeading" color="redesign.primaryText">GoGo</Text>
        <Text variant="introSmall" color="redesign.secondary" style={{ flex: 1 }}>{t('discovery.home')}</Text>
        <Pressable style={styles.headerAction} onPress={() => router.push('/places/search')} accessibilityRole="button" accessibilityLabel={t('search.title')}><MaterialIcon name="search" size={22} /></Pressable>
        <Pressable style={styles.headerAction} onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button" accessibilityLabel={t('profile.title')}>
          {initial ? <AvatarCircle label={initial} size={32} imageUri={me.data?.avatarUrl} /> : <MaterialIcon name="user" />}
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        testID="home-list"
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => Keyboard.dismiss()}
        onScroll={fab.onScroll}
        scrollEventThrottle={fab.scrollEventThrottle}
        contentContainerStyle={{ paddingTop: spacing[1], paddingBottom: fab.bottomInset }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Pressable accessibilityRole="button" onPress={chooseArea} style={styles.locationRow}>
              <MaterialIcon name="location" size={15} color="redesign.primaryText" />
              <Text variant="introCaptionMedium" color="redesign.secondary">{scopeLabel ?? t('home.chooseArea')}</Text>
            </Pressable>
            <Text variant="discoveryHeading">{me.data?.displayName?.trim() ? t('discovery.greetingName', { name: me.data.displayName.trim() }) : t('discovery.greeting')}</Text>
          </View>
          <Pressable
            testID="home-bell"
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unread.count > 0
                ? t('home.bellUnread', { count: badgeLabel(unread.count, unread.more) })
                : t('notifications.title')
            }
            hitSlop={8}
            style={styles.bell}
          >
            <Icon name="bell" size={22} color="text.primary" />
            {unread.count > 0 ? <View style={styles.bellBadge} /> : null}
          </Pressable>
        </View>

        {/* Suggestions still on screen from an earlier search (GoGo-MobileApp#253). */}
        <StaleNotice
          error={search.isError ? search.error : null}
          hasData={visualState === 'default'}
          onRetry={() => void search.refetch()}
        />

        <DraftResume />

        <LinearGradient colors={[theme.redesign.heroStart, theme.redesign.heroMiddle, theme.redesign.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View pointerEvents="none" style={styles.heroDecor}><MaterialIcon name="groups" size={140} color="redesign.primaryText" /></View>
          <View style={styles.heroBadge}><MaterialIcon name="bolt" color="redesign.primaryText" size={14} /><Text variant="introCaptionMedium" color="redesign.primaryText">{t('discovery.heroBadge')}</Text></View>
          <Text variant="discoveryTitle">{t('discovery.heroTitle')}</Text>
          <Text variant="introSmall" color="redesign.secondary" style={styles.heroBody}>{t('discovery.heroBody')}</Text>
          <Pressable accessibilityRole="button" onPress={startCreate} style={styles.heroPrimary}>
            <MaterialIcon name="plus" color="redesign.white" /><Text variant="introLabel" color="redesign.white">{t('discovery.createRoom')}</Text>
          </Pressable>
        </LinearGradient>
        <QuickJoin knownName={me.data?.displayName} />
        {showRoom && roomStatus ? <Pressable accessibilityRole="button" style={styles.nearestRoom} onPress={() => router.push(`/room/${homeRoom.id}`)}>
          <View style={styles.roomIcon}><MaterialIcon name="groups" color="redesign.white" size={20} /></View>
          <View style={styles.roomCopy}><Text variant="introCaptionMedium" color="redesign.violetText">{roomStatus}</Text><Text variant="introLabel">{homeRoom.title}</Text></View>
          <View style={styles.roomAction}><Text variant="introCaptionMedium" color="redesign.white">{t('discovery.enterRoom')}</Text></View>
        </Pressable> : null}
        {search.data?.pages[0]?.meta?.totalCount !== undefined && Object.keys(labels.mood ?? {}).length ? <View style={styles.moodSection}>
          <View style={styles.moodHeading}><Text variant="introHeading">{t('discovery.exploreMood')}</Text><GhostBtn label={t('discovery.allMoods')} onPress={() => setMoods([])} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
            {Object.entries(labels.mood ?? {}).map(([key, label]) => <Chip appearance="discovery" key={key} label={label} variant={moods.includes(key) ? 'selected' : moods.length >= 10 ? 'disabled' : 'default'} onPress={() => setMoods(prev => prev.includes(key) ? prev.filter(value => value !== key) : [...prev, key])} />)}
          </ScrollView>
        </View> : null}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <View style={styles.sectionHeader}>
            <Text variant="discoveryTitle">{t('discovery.suggested')}</Text>
            <GhostBtn label={t('discovery.more')} onPress={() => router.push(moods.length ? { pathname: '/places/search', params: { moods: moods.join(',') } } : '/places/search')} />
          </View>

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
                      void search.refetch()
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
                <PlaceCard
                  key={place.id}
                  place={place}
                  appearance="discovery"
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
      </ScrollView>
      </KeyboardAvoidingView>
    </Atmosphere>
  )
}
