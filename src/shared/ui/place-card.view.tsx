import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useCandidatePhoto, openStateFromHours, detailToPlaceCard, formatMinuteOfDay, formatDistance, placeCardRatingPriceLine, type ResolveLinkResult, type PlaceCard as PlaceCardModel } from '@/shared/api'
import { openWebsite } from '@/shared/navigation/external-links'
import { FormattedPlaceAddress } from './place-address.view'
import { priceUnitKey } from '@/shared/pricing/price-unit'
import { haptic } from './feedback'
import { IconBookmark } from './icons'
import { PlacePhoto } from './place-photo.view'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { usePlaceClock } from './use-place-clock'
import { styles } from './place-card.style'

export interface CardControls {
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  disabled?: boolean
  selected?: boolean
  saved?: boolean
  onToggleSave?: () => void
  headerAction?: ReactNode
  footer?: ReactNode
  photoOverlay?: ReactNode
  bodyLeading?: ReactNode
  bodyTrailing?: ReactNode
  headingAction?: ReactNode
  contributionBadge?: ReactNode
  unavailableLabel?: string
  tags?: readonly string[]
  categoryLabel?: string | null
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}
export type PlaceCardProps = CardControls & ({ place: PlaceCardModel; preview?: never } | {
  preview: NonNullable<ResolveLinkResult['candidate']>; place?: never
})

/** Provider preview is a data adapter, never a third card layout or a canonical identity. */
export function useCardData(props: PlaceCardProps) {
  const { t } = useTranslation()
  const candidate = props.preview
  const candidatePhoto = useCandidatePhoto(candidate ?? {})
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const photo = candidatePhoto.photo?.uri !== failedPhoto ? candidatePhoto.photo : null
  const now = usePlaceClock()
  const place = props.place ?? {
    ...detailToPlaceCard({ name: candidate!.name, addressText: candidate!.address,
      rating: candidate!.googleRating ?? undefined, ratingCount: candidate!.googleRatingCount ?? undefined, hours: candidate!.openingHours }),
    ...openStateFromHours(candidate!.openingHours, now),
    photoUrl: photo?.uri ?? null, photoSource: photo ? 'google' as const : null,
    photoAttribution: photo?.attribution ?? null,
    photoAuthors: photo?.authors.map(author => ({ ...author, uri: author.uri ?? null, photoUri: null })),
  }
  // Keep the extracted provider schedule, including daily/overnight facts.
  const hours = candidate?.openingHours ?? []
  const daily = hours.length === 7 && new Set(hours.map(hour => hour.dayOfWeek)).size === 7
    && hours.every(hour => hour.openMinute === hours[0].openMinute && hour.closeMinute === hours[0].closeMinute && hour.isOvernight === hours[0].isOvernight)
  const schedule = (daily ? hours.slice(0, 1) : hours).map(hour =>
    `${formatMinuteOfDay(hour.openMinute)}–${formatMinuteOfDay(hour.closeMinute)} ${t(daily ? 'placeImport.daily' : `common.weekday.${hour.dayOfWeek}`)}`,
  ).join(' · ')
  const statusLabel = candidate && place.openNow && schedule ? `${t('common.open')} · ${schedule}` : undefined
  return { place, candidate, statusLabel, loading: !!candidate && candidatePhoto.status === 'loading',
    photoError: () => setFailedPhoto(photo?.uri ?? null),
    extraCredits: [...new Set(candidate?.attributions ?? [])].filter(credit => credit.trim() !== photo?.attribution.trim()) }
}
export type CardData = ReturnType<typeof useCardData>

export function CardImage({ data, small = false }: { data: CardData; small?: boolean }) {
  const { t } = useTranslation()
  return <>
    <PlacePhoto placeId={data.place.id} name={data.place.name} uri={data.place.photoUrl}
      cachePolicy={data.candidate ? 'none' : undefined}
      imageTestID={data.candidate ? small ? 'place-preview-thumbnail' : 'import-candidate-photo' : undefined}
      onPhotoError={data.photoError} style={StyleSheet.absoluteFill} />
    {data.loading ? <View testID="import-candidate-photo-loading" style={StyleSheet.absoluteFill} accessible accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} /> : null}
  </>
}

export function CardPrice({ place, small = false }: { place: PlaceCardModel; small?: boolean }) {
  const { t, i18n } = useTranslation()
  const { price } = placeCardRatingPriceLine(place, unit => t(priceUnitKey(unit)), i18n.language)
  return price ? <Text testID="place-card-price" variant={small ? 'introCaption' : 'introLabel'} color="accent.primary" style={styles.discoveryPrice}>{price}</Text> : null
}

export function CardTags({ place, tags, categoryLabel }: { place: PlaceCardModel; tags?: readonly string[]; categoryLabel?: string | null }) {
  return <PlaceCardTags tags={[categoryLabel ?? place.discovery?.categoryLabel, ...(tags ?? place.discovery?.tagLabels ?? [])].filter((tag): tag is string => !!tag)} />
}

export function CardCredits({ data }: { data: CardData }) {
  const { t } = useTranslation()
  const { place, candidate, extraCredits } = data
  return <>
    {place.photoAttribution ? <Text testID={candidate ? 'import-photo-credit' : 'saved-photo-attribution'} variant="caption" color="text.secondary" style={styles.savedCredits}>
      {candidate ? t('placeImport.photoCredit') : place.photoSource === 'google' ? 'Google · ' : ''}
      {candidate ? null : place.photoAttribution}
      {place.photoAuthors?.map((author, index) => <Text key={`${index}-${author.displayName}`} variant="caption" accessibilityRole={author.uri ? 'link' : undefined} onPress={author.uri ? () => { void openWebsite(author.uri!) } : undefined}>{candidate ? index ? ', ' : '' : ' · '}{author.displayName}</Text>)}
      {candidate ? ` · ${place.photoAttribution}` : null}
    </Text> : null}
    {extraCredits.map(credit => <Text key={credit} variant="caption" color="text.secondary">{credit}</Text>)}
  </>
}

export function CardShell({ props, data, small = false, children, style }: { props: PlaceCardProps; data: CardData; small?: boolean; children: ReactNode; style: StyleProp<ViewStyle> }) {
  const Target = props.onPress ? Pressable : View
  return <View testID="place-card-surface" style={[styles.discoveryCard, style, props.style]}>
    <View testID={data.candidate ? small ? 'place-preview-compact' : 'import-preview-card' : undefined}>
      <Target testID="place-card-open-target" accessibilityRole={props.onPress ? 'button' : undefined} accessibilityLabel={props.accessibilityLabel ?? (props.onPress ? data.place.name : undefined)} accessibilityHint={props.accessibilityHint} accessibilityState={{ disabled: props.disabled, selected: props.selected }} disabled={props.disabled} onPress={props.onPress}>{children}</Target>
      {props.headerAction ? <View style={small ? styles.saveSmall : styles.saveOnPhoto}>{props.headerAction}</View> : props.saved != null && props.onToggleSave ? <SaveToggle compact={small} saved={props.saved} onToggle={props.onToggleSave} /> : null}
      <CardCredits data={data} />
      {props.footer ? <View style={styles.savedFooter}>{props.footer}</View> : null}
      {props.children ? <View style={styles.importActions}>{props.children}</View> : null}
    </View>
  </View>
}

/** "Đang mở · Đóng 23:00" composed from facts, never sent as a sentence. */
function useOpenLabel(place: PlaceCardModel, discovery = false): { label: string; open: boolean } | null {
  const { t } = useTranslation()
  const now = usePlaceClock()
  place = place.hours ? { ...place, ...openStateFromHours(place.hours, now) } : place
  if (place.providerStatus && ['closed', 'temporarily_closed', 'moved'].includes(place.providerStatus.status)) return null
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

export function SaveToggle({ saved, onToggle, compact }: {
  compact?: boolean
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
      style={compact ? styles.saveSmall : styles.saveOnPhoto}
    >
      <IconBookmark
        size={22}
        filled={saved}
        color={saved ? theme.accent.primary : theme.text.secondary}
      />
    </Pressable>
  )
}

/** A single visual language; variants change geometry only. */
export function PlaceCardAddress({ place, compact = false, pin = true }: {
  place: Parameters<typeof FormattedPlaceAddress>[0]['place']; compact?: boolean; pin?: boolean
}) {
  return <FormattedPlaceAddress place={place}>{address => address.trim() ?
    <View testID="place-card-address-row" style={styles.addressRow}>
      {pin ? <MaterialIcon name="location" size={compact ? 13 : 16} color="accent.primary" /> : null}
      <Text testID="place-card-meta" style={styles.addressText} variant={compact ? 'introCaption' : 'introSmall'} color="redesign.secondary"
        numberOfLines={compact ? 1 : 2} ellipsizeMode="tail" accessibilityLabel={address}>{address}</Text>
    </View> : null}</FormattedPlaceAddress>
}

/** Informational tags have no 44pt action target: Stitch draws caption pills. */
export function PlaceCardTags({ tags = [] }: { tags?: readonly string[] }) {
  return tags.length ? <View testID="place-card-tags" style={styles.discoveryTags}>{[...new Set(tags)].map(tag =>
    <View key={tag} style={styles.factTag}><Text variant="introCaption" color="redesign.secondary">{tag}</Text></View>)}</View> : null
}

export function Verified({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  return <View testID="place-card-verified" style={compact ? styles.compactVerified : styles.verifiedBadge}>
    <MaterialIcon name="verified" size={compact ? 10 : 14} color="text.inverse" />
    <Text variant="introCaptionMedium" color="text.inverse" numberOfLines={compact ? 1 : undefined}>{t('discovery.verified')}</Text>
  </View>
}

export function PlaceCardStatus({ place, inline = false, label }: { place: PlaceCardModel; inline?: boolean; label?: string }) {
  const { t } = useTranslation()
  const open = useOpenLabel(place, true)
  const distance = formatDistance(place.distanceM)
  if (!open && !distance) return null
  return <View testID="place-card-photo-badges" style={styles.photoBadges}>
    {open ? <View testID="place-card-hours-badge" style={[styles.photoBadge, !inline && styles.inverseBadge]}>
      <View testID="place-card-status-dot" style={[styles.openDot, !open.open && styles.closedDot, !inline && (open.open ? styles.photoOpenDot : styles.photoClosedDot)]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={styles.photoBadgeText} variant="introCaptionMedium" color={inline ? open.open ? 'redesign.greenText' : 'status.dangerText' : open.open ? 'onDark.success' : 'onDark.danger'}>{label ?? open.label}</Text>
    </View> : null}
    {distance ? <View testID="place-card-distance" style={[styles.photoBadge, !inline && styles.inverseBadge]}>
      <MaterialIcon name="nearMe" size={14} color={inline ? 'accent.primary' : 'text.inverse'} />
      <Text variant="introCaptionMedium" color={inline ? 'redesign.secondary' : 'text.inverse'} accessibilityLabel={t('saved.straightDistance', { distance })}>{distance}</Text>
    </View> : null}
  </View>
}
