import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  formatMinuteOfDay,
  isSaved,
  openStateFromHours,
  parseApiDate,
  toNumber,
  usePlaceDetail,
  useSaved,
  useTaxonomies,
  useToggleSaved,
} from '@/shared/api'
import { formatRange } from '@/shared/pricing/money'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { ErrorState, LoadingState, StaleNotice } from '@/shared/ui/async-state.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, GlassCard, TagChip } from '@/shared/ui/primitives'
import { IconChevronLeft, IconMapPin, IconNavigation } from '@/shared/ui/icons'
import { colors, hitSlop, spacing } from '@/shared/ui/tokens'

import { styles } from './place-detail.style'

const { neutral } = colors

/** Suitability scores are 0..1 from the ranking pipeline. */
const SUITABILITY_MAX = 1

export default function PlaceDetailScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { placeId } = useLocalSearchParams<{ placeId: string }>()
  const { status } = useSession()

  const addSeedPlace = useRoomStore(state => state.addSeedPlace)
  const place = usePlaceDetail(placeId)
  const taxonomies = useTaxonomies()
  const canSave = status === 'user'
  const saved = useSaved({ enabled: canSave })
  const toggleSaved = useToggleSaved()

  if (place.isPending) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <Pressable onPress={() => router.back()} accessibilityLabel={t('common.back')} style={styles.backInline}>
            <IconChevronLeft />
          </Pressable>
        </View>
        <LoadingState />
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away a cached plan; the error screen is
  // only for having nothing at all to show (APP-007).
  if (!place.data) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <Pressable onPress={() => router.back()} accessibilityLabel={t('common.back')} style={styles.backInline}>
            <IconChevronLeft />
          </Pressable>
        </View>
        <ErrorState error={place.error} onRetry={() => void place.refetch()} />
      </Atmosphere>
    )
  }

  const detail = place.data
  const id = detail.id ?? placeId
  const name = detail.name ?? ''
  const open = openStateFromHours(detail.hours)
  const price = detail.prices?.[0]
  // Numerics on this DTO can arrive as strings — see `toNumber`.
  const checkedAt = parseApiDate(detail.freshness_checked_at)
  const rating = toNumber(detail.rating)
  const ratingCount = toNumber(detail.rating_count)
  const priceLabel = formatRange(
    toNumber(price?.priceMin),
    toNumber(price?.priceMax),
    price?.currency ?? 'VND',
  )

  /** Taxonomy keys resolve to labels; the key is what the data actually holds. */
  function taxonomyLabel(kind: string, key: string): string {
    const entry = taxonomies.data?.kinds?.[kind]?.find(candidate => candidate.key === key)
    return entry?.labels?.[i18n.language] ?? entry?.labels?.vi ?? key
  }

  const tags = (detail.taxonomies ?? []).filter(entry => entry.kind && entry.key)
  const accessibility = tags.filter(entry => entry.kind === 'accessibility')
  const suitability = Object.entries(detail.suitability ?? {})
    .map(([key, value]) => [key, toNumber(value) ?? 0] as const)
    .sort((a, b) => b[1] - a[1])

  const destination = detail.address_text ?? (detail.lat != null && detail.lng != null ? `${detail.lat},${detail.lng}` : name)

  function onSave() {
    const currentlySaved = isSaved(saved.data, 'place', id)
    toggleSaved.mutate({ type: 'place', id, saved: currentlySaved })
    if (!currentlySaved) track('place_saved', { placeId: id })
  }

  return (
    <Atmosphere>
      <View style={styles.headerImage}>
        {/* `uri` stays null until the contract carries photos (GoGo-BE#151). */}
        <PlacePhoto placeId={id} name={name} uri={null} style={StyleSheet.absoluteFill} />
        <View style={styles.imageScrim} />
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel={t('common.back')}
          hitSlop={hitSlop}
          style={[styles.backBtn, { top: insets.top + spacing[2] }]}
        >
          <IconChevronLeft />
        </Pressable>
      </View>
      <StaleNotice error={place.isError ? place.error : null} onRetry={() => void place.refetch()} />

      <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[5] }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>
            {/* `area_key` is an internal key with no label source — omitted. */}
            {tags
              .filter(tag => tag.kind === 'category')
              .map(tag => taxonomyLabel('category', tag.key as string))
              .join(' · ')}
          </Text>

          {/* Rating always carries its sample size — a 5.0 from two people is
              not a 5.0 from two thousand (spec §27.1). */}
          {rating != null ? (
            <Text style={styles.rating}>
              ★ {rating.toFixed(1)}
              {ratingCount != null ? ` · ${t('placeDetail.ratingCount', { count: ratingCount })}` : ''}
            </Text>
          ) : null}

          {priceLabel ? (
            <Text style={styles.price}>
              {priceLabel}
              {price?.unit ? ` · ${t(`placeDetail.priceUnit.${price.unit}`, { defaultValue: '' })}` : ''}
            </Text>
          ) : null}

          <Text style={open.openNow ? styles.open : styles.closed}>
            {open.openNow
              ? formatMinuteOfDay(open.closesAtMinute)
                ? t('search.openUntil', { time: formatMinuteOfDay(open.closesAtMinute) })
                : t('common.open')
              : formatMinuteOfDay(open.opensAtMinute)
                ? t('search.closedOpens', { time: formatMinuteOfDay(open.opensAtMinute) })
                : t('common.closed')}
          </Text>

          {detail.address_text ? (
            <View style={styles.addressCard}>
              <View style={styles.addressIcon}>
                <IconMapPin />
              </View>
              <Text style={styles.addressLabel}>{detail.address_text}</Text>
            </View>
          ) : null}

          {tags.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('placeDetail.goodFor')}</Text>
              <View style={styles.tagRow}>
                {tags
                  .filter(tag => tag.kind !== 'accessibility')
                  .map(tag => (
                    <TagChip
                      key={`${tag.kind}:${tag.key}`}
                      label={taxonomyLabel(tag.kind as string, tag.key as string)}
                      color="violet"
                    />
                  ))}
              </View>
            </>
          ) : null}

          {/* Real suitability scores from the ranking pipeline, not invented bars. */}
          {suitability.length > 0 ? (
            <View style={styles.ratingsCard}>
              <Text style={styles.ratingsTitle}>{t('placeDetail.coupleRatings')}</Text>
              {suitability.map(([key, value]) => (
                <View key={key} style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{taxonomyLabel('suitability', key)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.ratingTrack}>
                      <View style={[styles.ratingFill, { width: `${Math.round((value / SUITABILITY_MAX) * 100)}%` }]} />
                    </View>
                    <Text style={styles.ratingValue}>{(value * 5).toFixed(1)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Only attributes with real data — no generic "accessible" claims
              (spec §27.3). */}
          {accessibility.length > 0 ? (
            <View style={styles.factsGrid}>
              {accessibility.map(entry => (
                <GlassCard key={entry.key} style={styles.factCard}>
                  <Text>♿</Text>
                  <Text style={styles.factLabel}>{taxonomyLabel('accessibility', entry.key as string)}</Text>
                </GlassCard>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              addSeedPlace({ placeId: id, name })
              track('date_create_started', { from: 'place_detail' })
              router.push('/create/type')
            }}
            accessibilityRole="button"
            style={styles.createFromPlace}
          >
            <Text style={styles.createFromPlaceLabel}>{t('placeDetail.createRoom')}</Text>
          </Pressable>

          {/* Provider facts must be shown with their attribution. */}
          {(detail.sources ?? []).map(source => (
            <Text key={source.url ?? source.provider} style={styles.attribution}>
              {source.attribution ?? source.provider}
            </Text>
          ))}

          <View style={styles.freshnessRow}>
            <Text style={styles.updated}>
              {checkedAt
                ? t('placeDetail.updatedAt', { date: checkedAt.toLocaleDateString(i18n.language) })
                : t('placeDetail.updated')}
            </Text>
            <Pressable
              accessibilityRole="button"
            >
              <Text style={styles.report}>{t('placeDetail.report')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing[4] }]}>
        {canSave ? (
          <Pressable
            onPress={onSave}
            accessibilityRole="togglebutton"
            accessibilityState={{ checked: isSaved(saved.data, 'place', id) }}
            accessibilityLabel={t('placeDetail.save')}
            style={styles.saveBtn}
          >
            <Text style={{ fontSize: 18 }}>{isSaved(saved.data, 'place', id) ? '🔖' : '📑'}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={styles.addBtn}
        >
          <Text style={styles.addLabel}>{t('placeDetail.addToPlan')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => openGoogleMapsDirections(destination)}
          style={styles.dirBtn}
        >
          <IconNavigation color={neutral[0]} />
          <Text style={styles.dirLabel}>{t('common.directions')}</Text>
        </Pressable>
      </View>
    </Atmosphere>
  )
}
