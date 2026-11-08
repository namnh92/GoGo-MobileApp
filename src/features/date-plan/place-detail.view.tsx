import { AppHeader, AppHeaderAction } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import {
  detailToPlaceCard,
  formatMinuteOfDay,
  isSaved,
  openStateFromHours,
  vietnamClock,
  parseApiDate,
  placePriceParts,
  usePlaceDetail,
  usePlaceProviderPhotos,
  usePlaceReviews,
  useSaved,
  useTaxonomyLabel,
  useToggleSaved,
  type ReviewOrder,
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
import { Icon, IconBookmark } from '@/shared/ui/icons'
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
import { usePlaceClock } from '@/shared/ui/use-place-clock'
import { PlaceReport } from './place-report.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { RatingChips } from '@/shared/ui/rating-chips.view'
import { PlaceReviews } from './place-reviews.view'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

/** Monday-first day order for the opening-hours table; `Date#getDay` is 0=Sun. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

export default function PlaceDetailScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const [actionHeight, setActionHeight] = useState(0)
  const actionInset = useBottomBarInset(actionHeight)
  const { placeId, section } = useLocalSearchParams<{ placeId: string; section?: string }>()
  const scroll = useRef<ScrollView>(null)
  const [bodyY, setBodyY] = useState<number | null>(null)
  const [reviewsY, setReviewsY] = useState<number | null>(null)
  useEffect(() => {
    if (section === 'reviews' && bodyY != null && reviewsY != null) scroll.current?.scrollTo({ y: bodyY + reviewsY, animated: false })
  }, [section, bodyY, reviewsY])
  const { status } = useSession()

  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  const now = usePlaceClock()
  const place = usePlaceDetail(placeId)
  const [reviewOrder, setReviewOrder] = useState<ReviewOrder>('latest')
  const reviews = usePlaceReviews(place.data ? place.data.id ?? placeId : undefined, reviewOrder)
  const providerPhotos = usePlaceProviderPhotos(place.data?.id ?? (place.data ? placeId : undefined))
  const waitingForNetwork = useWaitingForNetwork(place)
  const { resolve: taxonomyLabel } = useTaxonomyLabel()
  const canSave = status === 'user'
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  const [photoIndex, setPhotoIndex] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // The draft's top bar: back, the screen's name, report and save on the right.
  const header = (saveToggle: ReactNode, reportButton?: ReactNode) => (
    <AppHeader title={t('placeDetail.title')} onBack={() => goBackOrHome(router)} rightAction={<>{reportButton}{saveToggle}</>} />
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
  const firstReviewPage = reviews.data?.pages[0]
  // Header and list read the same moderated aggregate, regardless of which
  // refresh completes last. An omitted score below the threshold clears it.
  const card = detailToPlaceCard(firstReviewPage?.gogoRatingCount != null ? {
    ...detail, gogoRating: firstReviewPage.gogoRating, gogoRatingCount: firstReviewPage.gogoRatingCount,
  } : detail)
  const id = detail.id ?? placeId
  const name = detail.name ?? ''
  const open = openStateFromHours(detail.hours, now)
  const photos = [
    ...(detail.photos ?? []).map(photo => ({ ...photo, transient: false, googleMapsUri: photo.googleMapsUri ?? null, authorAttributions: photo.authorAttributions ?? [] })),
    ...(providerPhotos.data?.status === 'ok' ? providerPhotos.data.photos.map((photo, index) => ({
      id: `provider-${index}`,
      url: `data:${photo.contentType};base64,${photo.dataBase64}`,
      attribution: providerPhotos.data?.attribution,
      googleMapsUri: photo.googleMapsUri,
      authorAttributions: photo.authorAttributions,
      transient: true,
    })) : []),
  ]
  const checkedAt = parseApiDate(detail.freshnessCheckedAt)
  const price = placePriceParts(card)
  const today = vietnamClock(now).day

  const tags = (detail.taxonomies ?? []).filter(entry => entry.kind && entry.key)
  const categories = tags.filter(tag => tag.kind === 'category')
  const accessibility = tags.filter(entry => entry.kind === 'accessibility' || entry.kind === 'amenity')
  const vibes = tags.filter(entry => entry.kind === 'mood' || entry.kind === 'setting')

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
  if (detail.addressText?.trim() || (detail.areaSummary?.communeCode && detail.areaSummary.label?.trim() && detail.areaSummary.provinceCode)) {
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
            <Text variant="caption" color="text.secondary">{t('placeDetail.atmosphere')}</Text>
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
                <Chip key={entry.key} label={taxonomyLabel(entry.kind as string, entry.key as string)} />
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
    <AppHeaderAction
      onPress={onSave}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: currentlySaved }}
      accessibilityLabel={t(currentlySaved ? 'saved.remove' : 'placeDetail.save')}
    >
      {/* Saved is the filled glyph, not only a colour (RULE-DS, #382). */}
      <IconBookmark filled={currentlySaved} size={22} />
    </AppHeaderAction>
  ) : null

  const reportToggle = (
    <AppHeaderAction
      testID="place-detail-report"
      onPress={() => setReportOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={t('placeDetail.report')}
    >
      <Icon name="flag" size={22} color="text.secondary" />
    </AppHeaderAction>
  )

  return (
    <Atmosphere>
      {header(saveToggle, reportToggle)}
      <ScrollView
        ref={scroll}
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
              testID="place-detail-gallery-pages"
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
                  cachePolicy={photo.transient ? 'none' : undefined}
                  style={[styles.galleryPage, { width: galleryWidth }]}
                />
              ))}
            </ScrollView>
          ) : (
            <PlacePhoto placeId={id} name={name} uri={photos[0].url} cachePolicy={photos[0].transient ? 'none' : undefined} style={StyleSheet.absoluteFill} />
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

        {photos[photoIndex]?.attribution ? (
          <View style={styles.attribution}>
            {[
              { displayName: photos[photoIndex].attribution, uri: photos[photoIndex].googleMapsUri },
              ...photos[photoIndex].authorAttributions,
            ].map((credit, index) => credit.uri ? (
              <Pressable
                key={index}
                accessibilityRole="link"
                accessibilityLabel={credit.displayName}
                onPress={() => void openLink(() => openWebsite(credit.uri as string))}
                style={styles.attributionLink}
              >
                <Text variant="caption" color="accent.primary">{credit.displayName}</Text>
              </Pressable>
            ) : <Text key={index} variant="caption" color="text.secondary">{credit.displayName}</Text>)}
          </View>
        ) : null}

        <View testID="place-detail-sheet" style={styles.body} onLayout={event => setBodyY(event.nativeEvent.layout.y)}>
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
          {open.openNow != null ? <View style={styles.openRow}>
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
          </View> : null}

          <Sheet visible={hoursOpen} onClose={() => setHoursOpen(false)} header={<Text variant="title2">{t('placeDetail.weeklyHours')}</Text>}>
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
          </Sheet>
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
            <RatingChips place={card} />
            {card.gogoRatingCount != null && card.gogoRatingCount < 5 ? <Text variant="caption" color="text.secondary">{t('placeDetail.gogoBelowThreshold', { count: card.gogoRatingCount ?? 0 })}</Text> : null}
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
                  pins={[{ id, lat: detail.lat as number, lng: detail.lng as number, title: name, category: categories[0]?.key }]}
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
          {/* APP-056 — real, moderated GoGo reviews with their own loading and
              error states, so the facts above never wait on them. */}
          <PlaceReviews placeId={id} reviews={reviews} order={reviewOrder} onOrderChange={setReviewOrder} onLayout={event => setReviewsY(event.nativeEvent.layout.y)} />
        </View>
      </ScrollView>

      {reportOpen ? <PlaceReport placeId={id} onClose={() => setReportOpen(false)} /> : null}
      <GlassBar placement="floating" testID="place-detail-action-bar" onHeightChange={setActionHeight}>
        <PrimaryBtn label={t('placeDetail.createRoom')} onPress={addToPlan} icon="plus" />
      </GlassBar>
    </Atmosphere>
  )
}
