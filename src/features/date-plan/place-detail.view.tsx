import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  detailToPlaceCard,
  formatCount,
  formatMinuteOfDay,
  isSaved,
  openStateFromHours,
  parseApiDate,
  placePriceParts,
  ratingParts,
  toNumber,
  usePlaceDetail,
  useSaved,
  useTaxonomyLabel,
  useToggleSaved,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { openPhone, openWebsite } from '@/shared/navigation/external-links'
import { isStandalonePrice, priceUnitKey } from '@/shared/pricing/price-unit'
import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { Icon, IconBookmark, IconChevronLeft } from '@/shared/ui/icons'
import { MapCanvas } from '@/shared/ui/map-canvas.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { Atmosphere, Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { PlaceDetailSkeleton } from '@/shared/ui/skeleton.view'
import { PlaceAddressText } from '@/shared/ui/place-address.view'
import { Text } from '@/shared/ui/text'
import { hitSlop } from '@/shared/ui/tokens'

import { GALLERY_MARGIN, styles } from './place-detail.style'
import { AssistantPlaceCard } from '@/features/assistant/assistant-place-card.view'
import { PlaceDetailEmptyHero } from './place-detail-empty-hero.view'
import { PlaceReviews } from './place-reviews.view'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

/** Suitability scores are 0..1 from the ranking pipeline. */
const SUITABILITY_MAX = 1
const SUITABILITY_STARS = 5
/** Monday-first day order for the opening-hours table; `Date#getDay` is 0=Sun. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

export default function PlaceDetailScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [actionHeight, setActionHeight] = useState(0)
  const actionInset = useBottomBarInset(actionHeight)
  const { placeId } = useLocalSearchParams<{ placeId: string }>()
  const { status } = useSession()

  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  const place = usePlaceDetail(placeId)
  const waitingForNetwork = useWaitingForNetwork(place)
  const { resolve: taxonomyLabel } = useTaxonomyLabel()
  const canSave = status === 'user'
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  const [photoIndex, setPhotoIndex] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // The draft's top bar: back, the screen's name, report and save on the right.
  const header = (saveToggle: ReactNode, reportButton?: ReactNode) => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => goBackOrHome(router)}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          hitSlop={hitSlop}
          style={styles.headerBtn}
        >
          <IconChevronLeft />
        </Pressable>
        <Text variant="title2" numberOfLines={1} style={styles.headerTitle}>{t('placeDetail.title')}</Text>
        {reportButton}
        {saveToggle}
      </View>
    </View>
  )
  const backButton = header(null)

  if (waitingForNetwork) {
    return (
      <Atmosphere>
        {backButton}
        <OfflineState />
      </Atmosphere>
    )
  }

  if (place.isPending) {
    return (
      <Atmosphere>
        {backButton}
        <PlaceDetailSkeleton />
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away cached data; the error screen is only
  // for having nothing at all to show (APP-007).
  if (!place.data) {
    return (
      <Atmosphere>
        {backButton}
        <ErrorState error={place.error} onRetry={() => void place.refetch()} />
      </Atmosphere>
    )
  }

  const detail = place.data
  const card = detailToPlaceCard(detail)
  const id = detail.id ?? placeId
  const name = detail.name ?? ''
  const open = openStateFromHours(detail.hours)
  const photos = detail.photos ?? []
  const checkedAt = parseApiDate(detail.freshnessCheckedAt)
  const { google } = ratingParts(card)
  const price = placePriceParts(card)
  const today = new Date().getDay()

  const tags = (detail.taxonomies ?? []).filter(entry => entry.kind && entry.key)
  const categories = tags.filter(tag => tag.kind === 'category')
  const accessibility = tags.filter(entry => entry.kind === 'accessibility')
  const vibes = tags.filter(entry => entry.kind !== 'accessibility' && entry.kind !== 'category')
  const suitability = Object.entries(detail.suitability ?? {})
    .map(([key, value]) => [key, toNumber(value) ?? 0] as const)
    .sort((a, b) => b[1] - a[1])

  const categoryLine = categories.map(tag => taxonomyLabel('category', tag.key as string)).join(' · ')
  const destination = detail.addressText ?? (detail.lat != null && detail.lng != null ? `${detail.lat},${detail.lng}` : name)
  const hasCoords = detail.lat != null && detail.lng != null
  const currentlySaved = isSaved(saved.data, 'place', id)

  function openDirections() {
    haptic('select')
    openGoogleMapsDirections(destination)
  }

  function onSave() {
    haptic(currentlySaved ? 'select' : 'success')
    toggleSaved.mutate({ type: 'place', id, saved: currentlySaved })
    if (!currentlySaved) track('place_saved', { placeId: id })
  }

  /**
   * A place detail reached from anywhere has no plan in context, so "thêm vào
   * plan" means seeding the next room with it — the create flow that already
   * exists, not a new one (spec §1).
   */
  function addToPlan() {
    haptic('success')
    addSeedPlace({ placeId: id, name })
    track('date_create_started', { from: 'place_detail' })
    router.push('/create/type')
  }

  // A row the API did not fill is not built at all, so no hairline is left behind.
  const infoRows: { key: string; node: ReactNode; onPress?: () => void; label?: string }[] = []
  async function openLink(launch: () => Promise<boolean>) {
    const ok = await launch()
    setNotice(ok ? null : t('placeDetail.linkFailed'))
  }
  if (detail.addressText) {
    infoRows.push({
      key: 'address',
      node: (
        <>
          <View style={styles.infoIcon}><Icon name="mapPin" size={20} color="text.secondary" /></View>
          <View style={styles.infoBody}>
            <Text variant="caption" color="text.secondary">{t('placeDetail.address')}</Text>
            <PlaceAddressText place={detail} variant="body" />
          </View>
        </>
      ),
    })
  }
  if (detail.phone) {
    infoRows.push({
      key: 'phone',
      onPress: () => void openLink(() => openPhone(detail.phone as string)),
      label: t('placeDetail.callA11y', { phone: detail.phone }),
      node: (
        <>
          <View style={styles.infoIcon}><Icon name="support" size={20} color="text.secondary" /></View>
          <View style={styles.infoBody}>
            <Text variant="caption" color="text.secondary">{t('placeDetail.phone')}</Text>
            <Text variant="label" color="accent.primary">{detail.phone}</Text>
          </View>
        </>
      ),
    })
  }
  if (detail.website) {
    infoRows.push({
      key: 'website',
      onPress: () => void openLink(() => openWebsite(detail.website as string)),
      label: t('placeDetail.websiteA11y', { site: detail.website }),
      node: (
        <>
          <View style={styles.infoIcon}><Icon name="compass" size={20} color="text.secondary" /></View>
          <View style={styles.infoBody}>
            <Text variant="caption" color="text.secondary">{t('placeDetail.website')}</Text>
            <Text variant="label" color="accent.primary">{detail.website}</Text>
          </View>
        </>
      ),
    })
  }
  if (detail.avgVisitMinutes != null) {
    infoRows.push({
      key: 'visit',
      node: (
        <>
          <View style={styles.infoIcon}><Icon name="clock" size={20} color="text.secondary" /></View>
          <View style={styles.infoBody}>
            <Text variant="caption" color="text.secondary">{t('placeDetail.visitTime')}</Text>
            <Text variant="label">{t('datePlan.minutes', { n: detail.avgVisitMinutes })}</Text>
          </View>
        </>
      ),
    })
  }
  if (vibes.length > 0) {
    infoRows.push({
      key: 'goodFor',
      node: (
        <>
          <View style={styles.infoIcon}><Icon name="users" size={20} color="text.secondary" /></View>
          <View style={styles.infoBody}>
            <Text variant="caption" color="text.secondary">{t('placeDetail.goodFor')}</Text>
            <View style={styles.tagRow}>
              {vibes.map(tag => (
                <Chip key={`${tag.kind}:${tag.key}`} label={taxonomyLabel(tag.kind as string, tag.key as string)} />
              ))}
            </View>
          </View>
        </>
      ),
    })
  }
  // Only attributes with real data — no generic "accessible" claims.
  if (accessibility.length > 0) {
    infoRows.push({
      key: 'attributes',
      node: (
        <>
          <View style={styles.infoIcon}><Icon name="sparkle" size={20} color="text.secondary" /></View>
          <View style={styles.infoBody}>
            <Text variant="caption" color="text.secondary">{t('placeDetail.attributes')}</Text>
            <View style={styles.tagRow}>
              {accessibility.map(entry => (
                <Chip key={entry.key} label={taxonomyLabel('accessibility', entry.key as string)} />
              ))}
            </View>
          </View>
        </>
      ),
    })
  }
  if (checkedAt) {
    infoRows.push({
      key: 'checked',
      node: (
        <>
          <View style={styles.updatedIcon}><Icon name="checkCircle" size={16} color="text.secondary" /></View>
          <Text variant="bodySmall" color="text.secondary" style={styles.updated}>
            {t('placeDetail.updatedAt', { date: checkedAt.toLocaleDateString(i18n.language) })}
          </Text>
        </>
      ),
    })
  }

  const galleryWidth = width - GALLERY_MARGIN * 2

  function onGalleryScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / galleryWidth)
    if (next !== photoIndex) setPhotoIndex(next)
  }

  function openLabel(): string {
    if (open.openNow) {
      const closes = formatMinuteOfDay(open.closesAtMinute)
      return closes ? t('search.openUntil', { time: closes }) : t('common.open')
    }
    const opens = formatMinuteOfDay(open.opensAtMinute)
    return opens ? t('search.closedOpens', { time: opens }) : t('common.closed')
  }

  const saveToggle = canSave ? (
    <Pressable
      onPress={onSave}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: currentlySaved }}
      accessibilityLabel={t(currentlySaved ? 'saved.remove' : 'placeDetail.save')}
      hitSlop={hitSlop}
      style={styles.headerBtn}
    >
      {/* Saved is the filled glyph, not only a colour (RULE-DS, #382). */}
      <IconBookmark filled={currentlySaved} size={22} />
    </Pressable>
  ) : null

  // No report endpoint exists on `/v1` yet: the control stays unavailable and a
  // tap only shows the existing notice, as the page-body button did.
  const reportToggle = (
    <Pressable
      testID="place-detail-report"
      onPress={() => setNotice(t('placeDetail.reportUnavailable'))}
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={t('placeDetail.report')}
      hitSlop={hitSlop}
      style={styles.headerBtn}
    >
      <Icon name="flag" size={22} color="text.secondary" />
    </Pressable>
  )

  return (
    <Atmosphere>
      {header(saveToggle, reportToggle)}
      <ScrollView
        testID="place-detail-scroll"
        contentContainerStyle={{ paddingBottom: actionInset }}
        snapToEnd={false}
      >
        {/* Same 260pt hero with or without photos; no photo draws the illustration. */}
        <View testID="place-detail-gallery" style={styles.gallery}>
          {photos.length === 0 ? (
            <>
              <PlaceDetailEmptyHero />
              <View pointerEvents="none" style={styles.emptyCaptionWrap}>
                <View style={styles.emptyCaption}>
                  <Text variant="caption" color="text.secondary">{t('placeDetail.noPhoto')}</Text>
                </View>
              </View>
            </>
          ) : photos.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onGalleryScroll}
              scrollEventThrottle={32}
            >
              {photos.map(photo => (
                <PlacePhoto
                  key={photo.id}
                  placeId={id}
                  name={name}
                  uri={photo.url}
                  style={[styles.galleryPage, { width: galleryWidth }]}
                />
              ))}
            </ScrollView>
          ) : (
            <PlacePhoto placeId={id} name={name} uri={photos[0].url} style={StyleSheet.absoluteFill} />
          )}
          {photos.length > 0 ? <View pointerEvents="none" style={styles.imageScrim} /> : null}

          {photos.length > 1 ? (
            <>
              <View pointerEvents="none" style={styles.galleryDots}>
                {photos.map((photo, index) => (
                  <View
                    key={photo.id}
                    style={[styles.galleryDot, index === photoIndex && styles.galleryDotActive]}
                  />
                ))}
              </View>
              <View pointerEvents="none" style={styles.galleryCount}>
                <Text variant="caption" color="text.inverse">
                  {t('placeDetail.photoCount', { index: photoIndex + 1, total: photos.length })}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <View testID="place-detail-sheet" style={styles.body}>
          {notice ? (
            <Text
              variant="caption"
              color="text.secondary"
              accessibilityLiveRegion="polite"
              style={styles.reportNotice}
            >
              {notice}
            </Text>
          ) : null}
          <StaleNotice
            error={place.isError ? place.error : null}
            onRetry={() => void place.refetch()}
            style={styles.sheetNotice}
          />
          <Text variant="display">{name}</Text>
          {categoryLine ? <Text color="text.secondary" style={styles.meta}>{categoryLine}</Text> : null}

          {/* Colour is never the only signal — the dot repeats what the words say. */}
          <View style={styles.openRow}>
            <View style={[styles.openDot, open.openNow ? styles.openDotOn : styles.openDotOff]} />
            <Text variant="label" color={open.openNow ? 'status.successText' : 'text.secondary'}>{openLabel()}</Text>
            {(detail.hours ?? []).length > 0 ? (
              <Pressable
                onPress={() => setHoursOpen(value => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: hoursOpen }}
                hitSlop={hitSlop}
              >
                <Text variant="bodySmall" color="accent.primary" style={styles.hoursToggle}>
                  {t(hoursOpen ? 'placeDetail.hideHours' : 'placeDetail.showHours')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {hoursOpen ? (
            <View style={styles.hoursTable}>
              {WEEK.map(day => {
                const entries = (detail.hours ?? []).filter(entry => entry.dayOfWeek === day)
                const value = entries.length
                  ? entries
                      .map(entry =>
                        [formatMinuteOfDay(entry.openMinute), formatMinuteOfDay(entry.closeMinute)]
                          .filter(Boolean)
                          .join('–'),
                      )
                      .join(', ')
                  : t('common.closed')
                return (
                  <View key={day} style={styles.hoursRow}>
                    <Text variant={day === today ? 'label' : 'bodySmall'} color="text.secondary">
                      {t(`common.weekday.${day}`)}
                    </Text>
                    <Text variant={day === today ? 'label' : 'bodySmall'}>{value}</Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          {/* Price, then the two rating sources side by side and never merged
              (spec §6). A fact with no data is left out rather than drawn as a
              dash (RULE-CORE-015). */}
          <View testID="place-detail-facts" style={styles.facts}>
            {price.unit === 'unknown' ? null : isStandalonePrice(price.unit) ? (
              <View testID="place-detail-price" style={styles.priceRow}>
                <Icon name="dollar" size={20} color="text.secondary" />
                <Text variant="bodySmall" color="text.secondary">{t(priceUnitKey(price.unit))}</Text>
              </View>
            ) : (
              <View testID="place-detail-price" style={styles.priceRow}>
                <Icon name="dollar" size={20} color="accent.primary" />
                <Text variant="title2" color="accent.primary" numberOfLines={1} style={styles.priceText}>
                  {price.amount} <Text variant="bodySmall" color="text.secondary">{t(priceUnitKey(price.unit)).replace(/^\//, '')}</Text>
                </Text>
              </View>
            )}
            <View style={styles.ratingRow}>
              <View style={styles.ratingChip}>
                {google ? (
                  <>
                    <Text variant="label">★ {google.value.toFixed(1)}</Text>
                    {google.count != null ? (
                      <Text variant="caption" color="text.secondary">({formatCount(google.count, i18n.language)})</Text>
                    ) : null}
                    <Text variant="label">{t('rating.google')}</Text>
                  </>
                ) : (
                  <Text variant="label" color="text.secondary" numberOfLines={1}>{t('placeDetail.noRating')}</Text>
                )}
              </View>
              {/* The contract carries no GoGo aggregate yet, so the chip says so
                  in words instead of inventing a number. */}
              <View
                accessible
                accessibilityLabel={`${t('rating.gogo')}: ${t('rating.gogoInsufficient')}`}
                style={[styles.ratingChip, styles.ratingChipGogo]}
              >
                <Text variant="label" color="status.infoText">{t('rating.gogo')}</Text>
                <Text variant="caption" color="status.infoText" numberOfLines={1}>{t('placeDetail.gogoNone')}</Text>
              </View>
            </View>
          </View>

          {/* Questions about this place (#379): the contextual way into GoGo
              AI here — this screen has its own action bar, so no float button. */}
          <View style={styles.assistant}>
            <AssistantPlaceCard placeId={id} placeName={name} />
          </View>

          {infoRows.length > 0 ? (
            <View testID="place-detail-info" style={styles.infoCard}>
              {infoRows.map((row, index) =>
                row.onPress ? (
                  <Pressable
                    key={row.key}
                    accessibilityRole="link"
                    accessibilityLabel={row.label}
                    onPress={row.onPress}
                    style={({ pressed }) => [
                      styles.infoRow,
                      styles.infoRowLink,
                      index > 0 && styles.infoRowRule,
                      pressed && styles.infoRowPressed,
                    ]}
                  >
                    {row.node}
                  </Pressable>
                ) : (
                  <View key={row.key} style={[styles.infoRow, index > 0 && styles.infoRowRule]}>
                    {row.node}
                  </View>
                ),
              )}
            </View>
          ) : null}

          {/* The map is the directions control: one tap anywhere runs the
              existing handler. No coordinates, no map: a plain directions card
              takes its place so the capability is not lost. */}
          {hasCoords ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.directions')}
              onPress={openDirections}
              style={({ pressed }) => [styles.mapCard, pressed && styles.mapCardPressed]}
            >
              <View pointerEvents="none">
                <MapCanvas
                  interactive={false}
                  pins={[{ id, lat: detail.lat as number, lng: detail.lng as number, title: name }]}
                  style={styles.mapPreview}
                  fallback={
                    <View style={styles.mapFallback}>
                      <Text variant="bodySmall" color="text.secondary" style={styles.mapFallbackLabel}>{t('saved.mapUnavailable')}</Text>
                    </View>
                  }
                />
              </View>
              <View pointerEvents="none" style={styles.mapCorner}>
                <Icon name="navigation" size={16} color="accent.primary" filled />
                <Text variant="label" color="accent.primary">{t('common.directions')}</Text>
              </View>
              <Text variant="caption" color="text.secondary" pointerEvents="none" style={styles.mapAttribution}>
                {t('placeDetail.mapAttribution')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.directions')}
              onPress={openDirections}
              style={({ pressed }) => [styles.dirCard, pressed && styles.mapCardPressed]}
            >
              <Icon name="navigation" size={16} color="accent.primary" filled />
              <Text variant="label" color="accent.primary">{t('common.directions')}</Text>
            </Pressable>
          )}

          {/* Provider facts must be shown with their attribution. */}
          {(detail.sources ?? []).map(source => (
            <Text variant="caption" color="text.secondary" key={source.url ?? source.provider} style={styles.attribution}>
              {source.attribution ?? source.provider}
            </Text>
          ))}
          {photos[photoIndex]?.attribution ? (
            <Text variant="caption" color="text.secondary" style={styles.attribution}>{photos[photoIndex].attribution}</Text>
          ) : null}

          {/* Real suitability scores from the ranking pipeline, not invented bars. */}
          {suitability.length > 0 ? (
            <>
              <Text variant="title2" style={styles.sectionTitle}>{t('placeDetail.suitability')}</Text>
              <View style={styles.suitCard}>
                {suitability.map(([key, value]) => (
                  <View key={key} style={styles.suitRow}>
                    <Text variant="bodySmall" style={styles.suitLabel}>{taxonomyLabel('suitability', key)}</Text>
                    <View style={styles.suitTrack}>
                      <View style={[styles.suitFill, { width: `${Math.round((value / SUITABILITY_MAX) * 100)}%` }]} />
                    </View>
                    <Text variant="label" style={styles.suitValue}>{(value * SUITABILITY_STARS).toFixed(1)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* APP-056 — real, moderated GoGo reviews with their own loading and
              error states, so the facts above never wait on them. */}
          <PlaceReviews placeId={id} showPageLink />
        </View>
      </ScrollView>

      <GlassBar placement="floating" testID="place-detail-action-bar" onHeightChange={setActionHeight}>
        <PrimaryBtn label={t('placeDetail.createRoom')} onPress={addToPlan} icon="plus" style={styles.addBtn} />
      </GlassBar>
    </Atmosphere>
  )
}
