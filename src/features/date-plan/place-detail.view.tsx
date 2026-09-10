import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useWindowDimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  detailToPlaceCard,
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
import { isStandalonePrice, priceUnitKey } from '@/shared/pricing/price-unit'
import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { ErrorState, StaleNotice } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { IconChevronLeft, IconMapPin, IconNavigation } from '@/shared/ui/icons'
import { MapCanvas } from '@/shared/ui/map-canvas.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, Chip, GlassCard, SecondaryBtn } from '@/shared/ui/primitives'
import { PlaceDetailSkeleton } from '@/shared/ui/skeleton.view'
import { colors, glyph, hitSlop, spacing } from '@/shared/ui/tokens'

import { styles } from './place-detail.style'

const { brand, neutral } = colors

/** Suitability scores are 0..1 from the ranking pipeline. */
const SUITABILITY_MAX = 1
const SUITABILITY_STARS = 5
/** Monday-first day order for the opening-hours table; `Date#getDay` is 0=Sun. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

export default function PlaceDetailScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [actionHeight, setActionHeight] = useState(0)
  const { placeId } = useLocalSearchParams<{ placeId: string }>()
  const { status } = useSession()

  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  const place = usePlaceDetail(placeId)
  const { resolve: taxonomyLabel } = useTaxonomyLabel()
  const canSave = status === 'user'
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  const [photoIndex, setPhotoIndex] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)

  const backButton = (
    <View style={{ paddingTop: insets.top }}>
      <Pressable onPress={() => router.back()} accessibilityLabel={t('common.back')} hitSlop={hitSlop} style={styles.backInline}>
        <IconChevronLeft />
      </Pressable>
    </View>
  )

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
  const secondary = [categoryLine, detail.addressText].filter(Boolean).join(' · ')
  const destination = detail.addressText ?? (detail.lat != null && detail.lng != null ? `${detail.lat},${detail.lng}` : name)
  const hasCoords = detail.lat != null && detail.lng != null
  const currentlySaved = isSaved(saved.data, 'place', id)

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

  function onGalleryScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width)
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

  return (
    <Atmosphere>
      <ScrollView
        testID="place-detail-scroll"
        style={{ marginTop: insets.top + 44 + spacing[4] }}
        contentContainerStyle={{ paddingBottom: actionHeight }}
        snapToOffsets={[0, 252]}
        snapToEnd={false}
        decelerationRate="fast"
      >
      <View style={styles.gallery}>
        {photos.length > 1 ? (
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
                style={[styles.galleryPage, { width }]}
              />
            ))}
          </ScrollView>
        ) : (
          <PlacePhoto placeId={id} name={name} uri={photos[0]?.url ?? null} style={StyleSheet.absoluteFill} />
        )}
        <View pointerEvents="none" style={styles.imageScrim} />

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
              <Text style={styles.galleryCountLabel}>
                {photoIndex + 1}/{photos.length}
              </Text>
            </View>
          </>
        ) : null}


      </View>

      <StaleNotice error={place.isError ? place.error : null} onRetry={() => void place.refetch()} />

      {/* One vertical scroll surface lets the gallery leave the viewport as
          the sheet expands, then continues through the content naturally. */}
      <View style={[styles.sheet, { minHeight: height - insets.top - 44 - spacing[4] - actionHeight }]}>
        <View style={styles.body}>
          <View style={styles.identityRow}>
            <View style={styles.identityText}>
              <Text style={styles.name}>{name}</Text>
              {secondary ? <Text style={styles.meta}>{secondary}</Text> : null}
            </View>
            {canSave ? (
              <Pressable
                onPress={onSave}
                accessibilityRole="togglebutton"
                accessibilityState={{ checked: currentlySaved }}
                accessibilityLabel={t(currentlySaved ? 'saved.remove' : 'placeDetail.save')}
                style={[styles.saveBtn, currentlySaved && styles.saveBtnActive]}
              >
                <Text style={{ fontSize: glyph.xs }}>{currentlySaved ? '🔖' : '📑'}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* The three facts a decision actually turns on, side by side. */}
          <View style={styles.factStrip}>
            <View style={styles.fact}>
              {isStandalonePrice(price.unit) ? (
                <Text style={styles.factValueMuted}>{t(priceUnitKey(price.unit))}</Text>
              ) : (
                <>
                  <Text style={styles.factValue} numberOfLines={1}>{price.amount}</Text>
                  <Text style={styles.factCaption}>{t(priceUnitKey(price.unit)).replace(/^\//, '')}</Text>
                </>
              )}
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              {google ? (
                <>
                  <Text style={styles.factValue}>★ {google.value.toFixed(1)}</Text>
                  <Text style={styles.factCaption}>{t('rating.google')}</Text>
                </>
              ) : (
                <Text style={styles.factValueMuted}>{t('placeDetail.noRating')}</Text>
              )}
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              {detail.avgVisitMinutes != null ? (
                <>
                  <Text style={styles.factValue}>{t('datePlan.minutes', { n: detail.avgVisitMinutes })}</Text>
                  <Text style={styles.factCaption}>{t('placeDetail.avgVisit')}</Text>
                </>
              ) : (
                <Text style={styles.factValueMuted}>—</Text>
              )}
            </View>
          </View>

          {/* Colour is never the only signal — the dot repeats what the words say. */}
          <View style={styles.openRow}>
            <View style={[styles.openDot, { backgroundColor: open.openNow ? brand.mint : neutral[300] }]} />
            <Text style={open.openNow ? styles.open : styles.closed}>{openLabel()}</Text>
            {(detail.hours ?? []).length > 0 ? (
              <Pressable
                onPress={() => setHoursOpen(value => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: hoursOpen }}
                hitSlop={hitSlop}
              >
                <Text style={styles.hoursToggle}>
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
                    <Text style={[styles.hoursDay, day === today && styles.hoursToday]}>
                      {t(`common.weekday.${day}`)}
                    </Text>
                    <Text style={[styles.hoursValue, day === today && styles.hoursToday]}>{value}</Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          {detail.addressText || hasCoords ? (
            <View style={styles.addressCard}>
              {hasCoords ? (
                <MapCanvas
                  interactive={false}
                  pins={[{ id, lat: detail.lat as number, lng: detail.lng as number, title: name }]}
                  style={styles.mapPreview}
                  fallback={
                    <View style={styles.mapFallback}>
                      <Text style={styles.mapFallbackLabel}>{t('saved.mapUnavailable')}</Text>
                    </View>
                  }
                />
              ) : null}
              {detail.addressText ? (
                <View style={styles.addressRow}>
                  <View style={styles.addressIcon}>
                    <IconMapPin />
                  </View>
                  <Text style={styles.addressLabel}>{detail.addressText}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Google and GoGo measure different things and never merge into one
              star (spec §6). The contract carries no GoGo aggregate yet, so the
              second card says so in words instead of inventing a number. */}
          <Text style={styles.sectionTitle}>{t('placeDetail.ratingsTitle')}</Text>
          <View style={styles.ratingCards}>
            <View style={styles.ratingCard}>
              <Text style={styles.ratingSource}>{t('rating.google')}</Text>
              {google ? (
                <>
                  <Text style={styles.ratingValue}>★ {google.value.toFixed(1)}</Text>
                  {google.count != null ? (
                    <Text style={styles.ratingCount}>{t('placeDetail.ratingCount', { count: google.count })}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.ratingEmpty}>{t('placeDetail.noRating')}</Text>
              )}
            </View>
            <View style={styles.ratingCard}>
              <Text style={styles.ratingSource}>{t('rating.gogo')}</Text>
              <Text style={styles.ratingEmpty}>{t('rating.gogoInsufficient')}</Text>
            </View>
          </View>

          {vibes.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('placeDetail.goodFor')}</Text>
              <View style={styles.tagRow}>
                {vibes.map(tag => (
                  <Chip
                    key={`${tag.kind}:${tag.key}`}
                    label={taxonomyLabel(tag.kind as string, tag.key as string)}
                    variant="info"
                  />
                ))}
              </View>
            </>
          ) : null}

          {/* Real suitability scores from the ranking pipeline, not invented bars. */}
          {suitability.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('placeDetail.coupleRatings')}</Text>
              <View style={styles.suitCard}>
                {suitability.map(([key, value]) => (
                  <View key={key} style={styles.suitRow}>
                    <Text style={styles.suitLabel}>{taxonomyLabel('suitability', key)}</Text>
                    <View style={styles.suitTrack}>
                      <View style={[styles.suitFill, { width: `${Math.round((value / SUITABILITY_MAX) * 100)}%` }]} />
                    </View>
                    <Text style={styles.suitValue}>{(value * SUITABILITY_STARS).toFixed(1)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Only attributes with real data — no generic "accessible" claims. */}
          {accessibility.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('placeDetail.attributes')}</Text>
              <View style={styles.factsGrid}>
                {accessibility.map(entry => (
                  <GlassCard key={entry.key} style={styles.factCard}>
                    <Text>♿</Text>
                    <Text style={styles.factLabel}>{taxonomyLabel('accessibility', entry.key as string)}</Text>
                  </GlassCard>
                ))}
              </View>
            </>
          ) : null}

          {/* Provider facts must be shown with their attribution. */}
          <View style={styles.trustCard}>
            <View style={styles.trustRow}>
              <Text style={styles.updated}>
                {checkedAt
                  ? t('placeDetail.updatedAt', { date: checkedAt.toLocaleDateString(i18n.language) })
                  : t('placeDetail.updated')}
              </Text>
              {/* No report endpoint exists on `/v1` yet, so this stays visibly
                  unavailable rather than pretending to send something. */}
              <Text
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                style={styles.reportDisabled}
              >
                {t('placeDetail.report')}
              </Text>
            </View>
            <Text style={styles.reportHint}>{t('placeDetail.reportUnavailable')}</Text>
            {(detail.sources ?? []).map(source => (
              <Text key={source.url ?? source.provider} style={styles.attribution}>
                {source.attribution ?? source.provider}
              </Text>
            ))}
            {photos[photoIndex]?.attribution ? (
              <Text style={styles.attribution}>{photos[photoIndex].attribution}</Text>
            ) : null}
          </View>
        </View>
      </View>
      </ScrollView>

        <Pressable
          onPress={() => router.back()}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          hitSlop={hitSlop}
          style={[styles.backBtn, { top: insets.top + spacing[2] }]}
        >
          <IconChevronLeft />
        </Pressable>

      <View
        onLayout={event => setActionHeight(event.nativeEvent.layout.height)}
        style={[styles.actionBar, { paddingBottom: insets.bottom + spacing[4] }]}
      >
        <SecondaryBtn label={t('placeDetail.addToPlan')} onPress={addToPlan} style={styles.addBtn} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic('select')
            openGoogleMapsDirections(destination)
          }}
          style={({ pressed }) => [styles.dirBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        >
          <IconNavigation color={neutral[0]} />
          <Text style={styles.dirLabel}>{t('common.directions')}</Text>
        </Pressable>
      </View>
    </Atmosphere>
  )
}
