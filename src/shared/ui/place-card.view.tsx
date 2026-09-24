import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet as RNStyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import {
  formatMinuteOfDay,
  placeCardMetaLine,
  placeCardRatingPriceLine,
  type PlaceCard as PlaceCardModel,
} from '@/shared/api'
import { priceUnitKey } from '@/shared/pricing/price-unit'
import { Card } from '@/shared/ui/card.view'
import { haptic } from '@/shared/ui/feedback'
import { IconBookmark } from '@/shared/ui/icons'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Chip, TagChip } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

import { styles } from './place-card.style'

/**
 * The one Place Card (spec §21, #293 §3).
 *
 * Before this, Home, Search and Saved each had their own — different fields,
 * different type sizes, different idea of what mattered. One component means a
 * place looks like the same place wherever the user meets it.
 *
 * The list card is four lines, each one string on one line, so nothing can
 * wrap into its neighbour at 375pt:
 *   1. name (two lines allowed) + save
 *   2. category · area · distance
 *   3. ★ rating (count) · price/unit
 *   4. open state, in words
 * plus up to two reason chips when the caller passes `tags`. A fact with no
 * data is omitted, never placeholdered — an em-dash where a price should be
 * reads as "free" to some people and "broken" to the rest.
 */

export type PlaceCardVariant = 'list' | 'grid' | 'hero'

export interface PlaceCardProps {
  place: PlaceCardModel
  variant?: PlaceCardVariant
  onPress?: () => void
  /** Category label, already resolved from the taxonomy key via i18n. */
  categoryLabel?: string | null
  /** Reason/vibe tags, at most two render (spec §21). */
  tags?: string[]
  /** Omitted entirely for guests — saving needs an account. */
  saved?: boolean
  onToggleSave?: () => void
  style?: StyleProp<ViewStyle>
}

/** "Đang mở · Đóng 23:00" composed from facts, never sent as a sentence. */
function useOpenLabel(place: PlaceCardModel): { label: string; open: boolean } | null {
  const { t } = useTranslation()
  if (place.openNow == null) return null
  if (place.openNow) {
    const closes = formatMinuteOfDay(place.closesAtMinute)
    return { label: closes ? t('search.openUntil', { time: closes }) : t('common.open'), open: true }
  }
  const opens = formatMinuteOfDay(place.opensAtMinute)
  return { label: opens ? t('search.closedOpens', { time: opens }) : t('common.closed'), open: false }
}

function SaveToggle({ saved, onToggle, onPhoto = false }: {
  saved: boolean
  onToggle: () => void
  onPhoto?: boolean
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
      hitSlop={onPhoto ? 4 : undefined}
      style={onPhoto ? styles.saveOnPhoto : styles.save}
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
      ].join(', ')
    : undefined
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
          {' · '}
        </>
      ) : null}
      {price}
    </Text>
  )
}

/** Line 4. No dot: the words carry the state, so colour is never the only signal. */
function OpenLine({ place }: { place: PlaceCardModel }) {
  const state = useOpenLabel(place)
  if (!state) return null
  return (
    <Text
      testID="place-card-open"
      variant="label"
      color={state.open ? 'status.successText' : 'text.secondary'}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {state.label}
    </Text>
  )
}

function MetaLine({ place, categoryLabel }: { place: PlaceCardModel; categoryLabel?: string | null }) {
  // `areaKey` has no label source in the contract, so the area is the address
  // until GoGo-BE#169 — long, but one line with an ellipsis.
  const line = placeCardMetaLine(place, categoryLabel)
  if (!line) return null
  return (
    <Text testID="place-card-meta" variant="bodySmall" color="text.secondary" numberOfLines={1} ellipsizeMode="tail">
      {line}
    </Text>
  )
}

export function PlaceCard({
  place,
  variant = 'list',
  onPress,
  categoryLabel,
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
    <SaveToggle saved={saved} onToggle={onToggleSave} onPhoto={variant !== 'list'} />
  ) : null

  if (variant === 'hero') {
    const secondary = placeCardMetaLine(place, categoryLabel)
    return (
      <View style={[styles.wrap, style]}>
        <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
          <View style={styles.heroCard}>
            <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={RNStyleSheet.absoluteFill} />
            <View style={styles.heroScrim} />
            <View style={styles.heroBody}>
              <Text variant="title1" color="onDark.strong" numberOfLines={2}>{place.name}</Text>
              {secondary ? <Text variant="bodySmall" color="onDark.medium" numberOfLines={1}>{secondary}</Text> : null}
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

  if (variant === 'grid') {
    return (
      <View style={[styles.wrap, style]}>
        <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
          <Card padded={false} style={styles.gridCard}>
            <View style={styles.gridThumbWrap}>
              <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={RNStyleSheet.absoluteFill} />
            </View>
            <View style={styles.gridBody}>
              <Text variant="title2" numberOfLines={1}>{place.name}</Text>
              <MetaLine place={place} categoryLabel={categoryLabel} />
              <RatingPriceLine place={place} />
              <OpenLine place={place} />
            </View>
          </Card>
        </Pressable>
        {save}
      </View>
    )
  }

  return (
    <View style={[styles.wrap, style]}>
      <Pressable testID="place-card-open-target" onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
        <Card testID="place-card" style={styles.listCard}>
          <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={styles.listThumb} />
          <View style={styles.listBody}>
            <View style={styles.nameRow}>
              <Text testID="place-card-name" variant="title2" numberOfLines={2} ellipsizeMode="tail" style={styles.name}>
                {place.name}
              </Text>
              {/* Keeps the name clear of the toggle drawn over this corner. */}
              {canSave ? <View style={styles.saveSpace} /> : null}
            </View>
            <MetaLine place={place} categoryLabel={categoryLabel} />
            <RatingPriceLine place={place} />
            <OpenLine place={place} />
            {visibleTags.length > 0 ? (
              <View style={styles.tags}>
                {visibleTags.map(tag => (
                  <Chip key={tag} label={tag} variant="info" />
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
