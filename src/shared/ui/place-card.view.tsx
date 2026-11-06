import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import {
  useCandidatePhoto,
  openStateFromHours,
  type ResolveLinkResult,
  formatMinuteOfDay,
  formatRating,
  formatCount,
  ratingParts,
  placeCardRatingPriceLine,
  type PlaceCard as PlaceCardModel,
} from '@/shared/api'
import { FormattedPlaceAddress } from '@/shared/ui/place-address.view'
import { priceUnitKey } from '@/shared/pricing/price-unit'
import { Card } from '@/shared/ui/card.view'
import { haptic } from '@/shared/ui/feedback'
import { IconBookmark } from '@/shared/ui/icons'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Chip, TagChip } from '@/shared/ui/primitives'
import { MaterialIcon } from './material-icon'
import { Text } from '@/shared/ui/text'

import { usePlaceClock } from './use-place-clock'
import { RatingChips } from './rating-chips.view'
import { styles } from './place-card.style'

/**
 * The one Place Card (spec §21, #293 §3).
 *
 * Before this, Home, Search and Saved each had their own — different fields,
 * different type sizes, different idea of what mattered. One component means a
 * place looks like the same place wherever the user meets it.
 *
 * The list card is the Stitch card: a 16:10 photo over the body (Home, Search,
 * Saved drafts). The body omits missing facts and allows the address two lines:
 *   1. name (two lines allowed); the save toggle sits on the photo
 *   2. street, ward, city (shared by every appearance and variant)
 *   3. ★ rating (count) · price/unit
 *   4. open state, in words
 * plus up to two reason chips when the caller passes `tags`. A fact with no
 * data is omitted, never placeholdered — an em-dash where a price should be
 * reads as "free" to some people and "broken" to the rest.
 */

export type PlaceCardVariant = 'list' | 'hero'

export interface PlaceCardProps {
  place: PlaceCardModel
  appearance?: 'default' | 'discovery'
  variant?: PlaceCardVariant
  onPress?: () => void
  /** @deprecated The address row now uses street, ward and city facts. */
  categoryLabel?: string | null
  /** Reason/vibe tags, at most two render (spec §21). */
  tags?: string[]
  /** Omitted entirely for guests — saving needs an account. */
  saved?: boolean
  onToggleSave?: () => void
  style?: StyleProp<ViewStyle>
}

/** "Đang mở · Đóng 23:00" composed from facts, never sent as a sentence. */
function useOpenLabel(place: PlaceCardModel, discovery = false): { label: string; open: boolean } | null {
  const { t } = useTranslation()
  if (place.openNow == null) return null
  if (place.openNow) {
    const closes = formatMinuteOfDay(place.closesAtMinute)
    return { label: closes ? t(discovery ? 'discovery.openUntil' : 'search.openUntil', { time: closes }) : t('common.open'), open: true }
  }
  const opens = formatMinuteOfDay(place.opensAtMinute)
  if (discovery && opens && place.opensDayOffset === 1) return { label: t('discovery.closedTomorrow', { time: opens }), open: false }
  if (discovery && opens && (place.opensDayOffset ?? 0) > 1) return { label: t('discovery.closedLater', { time: opens, days: place.opensDayOffset }), open: false }
  return { label: opens ? t('search.closedOpens', { time: opens }) : t('common.closed'), open: false }
}

function SaveToggle({ saved, onToggle }: {
  saved: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return (
    <Pressable
      testID="place-card-save"
      onPress={() => {
        haptic('select')
        onToggle()
      }}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: saved }}
      accessibilityLabel={t(saved ? 'saved.remove' : 'placeDetail.save')}
      style={styles.saveOnPhoto}
    >
      <IconBookmark
        size={22}
        filled={saved}
        color={saved ? theme.accent.primary : theme.text.secondary}
      />
    </Pressable>
  )
}

/**
 * Line 3. One `Text`, so rating and price truncate together as one string
 * instead of wrapping apart; the score sits in a nested `label` Text for
 * weight. The word "Google" is not on screen (owner decision 2026-09-24,
 * RULE-CORE-014) — it is in the line's accessibility label.
 *
 */
function RatingPriceLine({ place }: { place: PlaceCardModel }) {
  const { t, i18n } = useTranslation()
  const { rating, price } = placeCardRatingPriceLine(place, unit => t(priceUnitKey(unit)), i18n.language)
  const a11y = rating
    ? [
        rating.count != null
          ? t('placeCard.ratingA11y', { rating: rating.score, count: rating.count })
          : t('placeCard.ratingA11yNoCount', { rating: rating.score }),
        price,
      ].filter(Boolean).join(', ')
    : undefined
  if (!rating && !price) return null
  return (
    <Text
      testID="place-card-rating-price"
      variant="bodySmall"
      numberOfLines={1}
      ellipsizeMode="tail"
      accessibilityLabel={a11y}
    >
      {rating ? (
        <>
          {'★ '}
          <Text variant="label">{rating.score}</Text>
          {rating.count != null ? ` (${rating.count})` : ''}
          {price ? ' · ' : ''}
        </>
      ) : null}
      {price ? <Text variant="label" color="accent.primary">{price}</Text> : null}
    </Text>
  )
}

/**
 * Line 4. The words carry the state, so colour is never the only signal. Open
 * also gets the round `status.success` dot (#293 §6, #297): under the green
 * theme `status.successText` is the same dark green as a filled button, and
 * the dot plus the absence of a fill is what keeps "Đang mở" from reading as
 * a control.
 */
function OpenLine({ place }: { place: PlaceCardModel }) {
  const state = useOpenLabel(place)
  if (!state) return null
  return (
    <View style={styles.openRow}>
      {state.open ? <View testID="place-card-open-dot" style={styles.openDot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      <Text
        testID="place-card-open"
        variant="label"
        color={state.open ? 'status.successText' : 'text.secondary'}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.openLabel}
      >
        {state.label}
      </Text>
    </View>
  )
}

function MetaLine({ place, appearance = 'default', hero = false }: {
  place: PlaceCardModel; appearance?: PlaceCardProps['appearance']; hero?: boolean
}) {
  return <FormattedPlaceAddress place={place}>{address => {
    if (!address.trim()) return null
    const line = <Text testID="place-card-meta" style={appearance === 'discovery' ? styles.addressText : undefined}
      variant={appearance === 'discovery' ? 'introSmall' : 'bodySmall'} color={hero ? 'onDark.medium' : appearance === 'discovery' ? 'redesign.secondary' : 'text.secondary'}
      numberOfLines={2} ellipsizeMode="tail" accessibilityLabel={address}>{address}</Text>
    return appearance === 'discovery' ? <View style={styles.addressRow}><MaterialIcon name="location" size={16} color="redesign.secondary" />{line}</View> : line
  }}</FormattedPlaceAddress>
}

function CanonicalPlaceCard({
  place,
  variant = 'list',
  appearance = 'default',
  onPress,
  tags = [],
  saved,
  onToggleSave,
  style,
}: PlaceCardProps) {
  const canSave = saved != null && onToggleSave != null
  const visibleTags = tags.slice(0, 2)

  // The save toggle is a sibling of the card's pressable, never inside it: a
  // screen reader treats a pressable as one element, and a toggle nested in it
  // cannot be reached on its own.
  const save = canSave ? (
    <SaveToggle saved={saved} onToggle={onToggleSave} />
  ) : null

  if (variant === 'hero') {
    return (
      <View style={[styles.wrap, style]}>
        <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
          <View style={styles.heroCard}>
            <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
            <View style={styles.heroScrim} />
            <View style={styles.heroBody}>
              <Text variant="title1" color="onDark.strong" numberOfLines={2}>{place.name}</Text>
              <MetaLine place={place} hero />
              {visibleTags.length > 0 ? (
                <View style={styles.heroTags}>
                  {visibleTags.map(tag => (
                    <TagChip key={tag} label={tag} color="violet" />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
        {save}
      </View>
    )
  }

  if (appearance === 'discovery') return <DiscoveryCard place={place} onPress={onPress} save={save} style={style} />

  return (
    <View style={[styles.wrap, style]}>
      <Pressable testID="place-card-open-target" onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
        <Card testID="place-card" padded={false} style={styles.listCard}>
          <View style={styles.listPhoto}>
            <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.listBody}>
            <View style={styles.listHead}>
              <Text testID="place-card-name" variant="title2" numberOfLines={2} ellipsizeMode="tail">
                {place.name}
              </Text>
              <MetaLine place={place} />
            </View>
            <RatingPriceLine place={place} />
            <OpenLine place={place} />
            {visibleTags.length > 0 ? (
              <View style={styles.tags}>
                {visibleTags.map(tag => (
                  <Chip key={tag} label={tag} style={styles.tagChip} />
                ))}
              </View>
            ) : null}
          </View>
        </Card>
      </Pressable>
      {save}
    </View>
  )
}


function DiscoveryCard({ place, onPress, save, style }: Pick<PlaceCardProps, 'place' | 'onPress' | 'style'> & { save: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const { google, gogo } = ratingParts(place)
  const { price } = placeCardRatingPriceLine(place, unit => t(priceUnitKey(unit)), i18n.language)
  const open = useOpenLabel(place, true)
  return <View style={[styles.wrap, style]}>
    <Pressable testID="place-card-open-target" accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
      <View testID="place-card-discovery" style={styles.discoveryCard}>
        <View style={styles.listPhoto}>
          <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
          {place.discovery?.verified === true ? <View style={styles.verifiedBadge}><MaterialIcon name="verified" size={14} color="redesign.white" /><Text variant="introCaptionMedium" color="redesign.white">{t('discovery.verified')}</Text></View> : null}
          {open ? <View testID="place-card-photo-badges" pointerEvents="none" style={styles.photoBadges}>
          <View testID="place-card-hours-badge" style={styles.photoBadge}><Text numberOfLines={2} style={styles.photoBadgeText} variant="introCaptionMedium" color={open.open ? 'redesign.greenText' : 'redesign.secondary'}>{open.open ? '● ' : ''}{open.label}</Text></View>
          </View> : null}
        </View>
        <View style={styles.listBody}>
          <View style={styles.discoveryHead}>
            <Text testID="place-card-name" variant="discoveryHeading" color="redesign.ink" style={styles.discoveryName} numberOfLines={1} ellipsizeMode="tail">{place.name}</Text>
            {price ? <Text variant="introLabel" color="redesign.primaryText" style={styles.discoveryPrice}>{price}</Text> : null}
          </View>
          <MetaLine place={place} appearance="discovery" />
          {google || gogo || place.gogoRatingCount != null ? <View style={styles.ratingBadges}>
            {google ? <View style={styles.googleBadge}><Text variant="introCaptionMedium" color="redesign.ink">{t('discovery.googleRating', { score: formatRating(google.value, i18n.language), count: google.count == null ? '' : `(${formatCount(google.count, i18n.language)})` })}</Text></View> : null}
            {gogo ? <View style={styles.gogoBadge}><Text variant="introSmall" color="redesign.violetText">{t('discovery.gogoRating', { score: formatRating(gogo.value, i18n.language), count: formatCount(gogo.count ?? 0, i18n.language) })}</Text></View> : place.gogoRatingCount != null ? <View style={styles.gogoBadge}><Text variant="introCaption" color="redesign.violetText">{t('discovery.gogoFewReviews')}</Text></View> : null}
          </View> : null}
          {place.discovery?.tagLabels?.length ? <View style={styles.discoveryTags}>{place.discovery.tagLabels.map(label => <View key={label} style={styles.googleBadge}><Text variant="introCaptionMedium" color="redesign.secondary">{label}</Text></View>)}</View> : null}
        </View>
      </View>
    </Pressable>
    {save}
  </View>
}

/** A resolved provider identity has no canonical GoGo ID and no place actions. */
export interface PlacePreviewProps {
  variant: 'preview'
  preview: NonNullable<ResolveLinkResult['candidate']>
  categoryLabel?: string | null
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function PlaceCard(props: PlaceCardProps | PlacePreviewProps) {
  return 'preview' in props ? <PreviewCard {...props} /> : <CanonicalPlaceCard {...props} />
}

function PreviewCard({ preview, categoryLabel, children, style }: PlacePreviewProps) {
  const { t } = useTranslation()
  const now = usePlaceClock()
  const candidatePhoto = useCandidatePhoto(preview)
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const photo = candidatePhoto?.uri !== failedPhoto ? candidatePhoto : null
  const open = openStateFromHours(preview.openingHours, now)
  const closing = formatMinuteOfDay(open.closesAtMinute)
  return (
    <Card padded={false} style={[styles.listCard, style]}>
      {photo ? <View style={styles.listPhoto}><Image testID="import-candidate-photo" source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="none" onError={() => setFailedPhoto(photo.uri)} accessible accessibilityLabel={preview.name} /></View> : null}
      <View style={styles.listBody}>
        <Text variant="caption" color="text.secondary">{t('placeImport.verifiedBadge')}</Text>
        <Text variant="title1">{preview.name}</Text>
        {preview.address ? <Text color="text.secondary">{preview.address}</Text> : null}
        {categoryLabel ? <Text variant="bodySmall">{categoryLabel}</Text> : null}
        <RatingChips place={{ rating: preview.googleRating ?? undefined, ratingCount: preview.googleRatingCount ?? undefined, ratingSource: 'google' }} />
        {open.openNow != null ? <Text variant="bodySmall">{open.openNow ? closing ? t('search.openUntil', { time: closing }) : t('common.open') : t('common.closed')}</Text> : null}
        {photo ? <Text variant="caption" color="text.secondary">{photo.credit}</Text> : null}
        {children}
        {(preview.attributions ?? []).map(attribution => <Text key={attribution} variant="caption" color="text.secondary">{attribution}</Text>)}
      </View>
    </Card>
  )
}
