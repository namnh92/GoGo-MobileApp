import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import {
  areaLabel,
  formatDistance,
  formatMinuteOfDay,
  placePriceParts,
  ratingParts,
  type PlaceCard as PlaceCardModel,
} from '@/shared/api'
import { isStandalonePrice, priceUnitKey } from '@/shared/pricing/price-unit'
import { haptic } from '@/shared/ui/feedback'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Chip, GlassCard, TagChip } from '@/shared/ui/primitives'
import { colors } from '@/shared/ui/tokens'

import { styles } from './place-card.style'

const { brand, neutral } = colors

/**
 * The one Place Card (spec §21).
 *
 * Before this, Home, Search and Saved each had their own — different fields,
 * different type sizes, different idea of what mattered. One component means a
 * place looks like the same place wherever the user meets it.
 *
 * The hierarchy is fixed: image → name → category · district → rating → distance
 * · price → open state → tags → save. What is *not* fixed is which of those
 * render: a fact with no data is omitted, never placeholdered, because an
 * em-dash where a price should be reads as "free" to some people and "broken"
 * to the rest.
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

/** "Đang mở · đến 23:00" composed from facts, never sent as a sentence. */
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
  return (
    <Pressable
      onPress={() => {
        haptic('select')
        onToggle()
      }}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: saved }}
      accessibilityLabel={t(saved ? 'saved.remove' : 'placeDetail.save')}
      hitSlop={12}
      style={[styles.saveBtn, onPhoto && styles.saveBtnOnPhoto]}
    >
      <Text style={styles.saveGlyph}>{saved ? '🔖' : '📑'}</Text>
    </Pressable>
  )
}

/** Rating always carries its source and its sample size (spec §6). */
function Rating({ place }: { place: PlaceCardModel }) {
  const { t } = useTranslation()
  const { google } = ratingParts(place)
  if (!google) return null
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingSource}>{t('rating.google')}</Text>
      <Text style={styles.ratingValue}>★ {google.value.toFixed(1)}</Text>
      {google.count != null ? (
        <Text style={styles.ratingCount}>· {t('placeDetail.ratingCount', { count: google.count })}</Text>
      ) : null}
    </View>
  )
}

function Price({ place }: { place: PlaceCardModel }) {
  const { t } = useTranslation()
  const { amount, unit } = placePriceParts(place)

  // "Miễn phí" and "Chưa có thông tin giá" are the whole line, not a suffix.
  if (isStandalonePrice(unit)) {
    return <Text style={unit === 'free' ? styles.priceFree : styles.priceUnknown}>{t(priceUnitKey(unit))}</Text>
  }
  if (!amount) return null
  return (
    <Text style={styles.price} numberOfLines={1}>
      {amount}
      <Text style={styles.meta}>{t(priceUnitKey(unit))}</Text>
    </Text>
  )
}

function OpenState({ place }: { place: PlaceCardModel }) {
  const state = useOpenLabel(place)
  if (!state) return null
  return (
    <View style={styles.openRow}>
      {/* The dot is redundant with the wording on purpose — colour is never the
          only signal (RULE-DS). */}
      <View style={[styles.openDot, { backgroundColor: state.open ? brand.mint : neutral[300] }]} />
      <Text style={state.open ? styles.open : styles.closed}>{state.label}</Text>
    </View>
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

  // `areaKey` is an internal key (`hcm_q3`) with no label source in the
  // contract, so the district line falls back to the address (GoGo-BE#169).
  const secondary = [categoryLabel, areaLabel(place)].filter(Boolean).join(' · ')
  const distance = formatDistance(place.distanceM)
  const visibleTags = tags.slice(0, 2)

  if (variant === 'hero') {
    return (
      <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={style}>
        <View style={styles.heroCard}>
          <PlacePhoto
            placeId={place.id}
            name={place.name}
            uri={place.photoUrl}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroScrim} />
          {canSave ? <SaveToggle saved={saved} onToggle={onToggleSave} onPhoto /> : null}
          <View style={styles.heroBody}>
            <Text style={styles.heroName} numberOfLines={2}>{place.name}</Text>
            {secondary ? <Text style={styles.heroMeta} numberOfLines={1}>{secondary}</Text> : null}
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
    )
  }

  if (variant === 'grid') {
    return (
      <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={style}>
        <GlassCard style={styles.gridCard}>
          <View style={styles.gridThumbWrap}>
            <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
            {canSave ? <SaveToggle saved={saved} onToggle={onToggleSave} onPhoto /> : null}
          </View>
          <View style={styles.gridBody}>
            <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
            {secondary ? <Text style={styles.category} numberOfLines={1}>{secondary}</Text> : null}
            <Rating place={place} />
            <Price place={place} />
            <OpenState place={place} />
          </View>
        </GlassCard>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={style}>
      <GlassCard style={styles.listCard}>
        <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={styles.listThumb} />
        <View style={styles.listBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
            {canSave ? <SaveToggle saved={saved} onToggle={onToggleSave} /> : null}
          </View>
          {secondary ? <Text style={styles.category} numberOfLines={1}>{secondary}</Text> : null}
          <Rating place={place} />
          <View style={styles.ratingRow}>
            {distance ? <Text style={styles.meta}>{distance}</Text> : null}
            {distance ? <Text style={styles.meta}>·</Text> : null}
            <Price place={place} />
          </View>
          <OpenState place={place} />
          {visibleTags.length > 0 ? (
            <View style={styles.tags}>
              {visibleTags.map(tag => (
                <Chip key={tag} label={tag} variant="info" />
              ))}
            </View>
          ) : null}
          {/* Provider imagery must be shown with its attribution. */}
          {place.photoAttribution ? (
            <Text style={styles.attribution} numberOfLines={1}>{place.photoAttribution}</Text>
          ) : null}
        </View>
      </GlassCard>
    </Pressable>
  )
}
