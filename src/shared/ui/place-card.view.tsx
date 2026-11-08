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
  formatDistance,
  placeCardRatingPriceLine,
  type PlaceCard as PlaceCardModel,
} from '@/shared/api'
import { openWebsite } from '@/shared/navigation/external-links'
import { FormattedPlaceAddress } from '@/shared/ui/place-address.view'
import { priceUnitKey } from '@/shared/pricing/price-unit'
import { haptic } from '@/shared/ui/feedback'
import { IconBookmark } from '@/shared/ui/icons'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Chip } from '@/shared/ui/primitives'
import { MaterialIcon } from './material-icon'
import { Text } from '@/shared/ui/text'
import { RatingChips, GoogleRatingBadge } from './rating-chips.view'

import { usePlaceClock } from './use-place-clock'
import { styles } from './place-card.style'
import { Skeleton } from './skeleton.view'

/** One place presentation across features. Geometry varies; fact styles do not. */
export type PlaceCardVariant = 'list' | 'hero' | 'compact'

export interface PlaceCardProps {
  place: PlaceCardModel
  appearance?: 'default' | 'discovery' | 'saved' | 'contribution'
  contributionBadge?: ReactNode
  headerAction?: ReactNode
  unavailableLabel?: string
  photoCategoryLabel?: string
  footer?: ReactNode
  /** Omit the photo row when the caller has no verified image. */
  showPhoto?: boolean
  variant?: PlaceCardVariant
  onPress?: () => void
  /** @deprecated The address row now uses street, ward and city facts. */
  categoryLabel?: string | null
  /** Localized reason/vibe tags; CMS tags are used when omitted. */
  tags?: readonly string[]
  /** Omitted entirely for guests — saving needs an account. */
  saved?: boolean
  onToggleSave?: () => void
  style?: StyleProp<ViewStyle>
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

function SaveToggle({ saved, onToggle, compact }: {
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
      style={[styles.saveOnPhoto, compact ? styles.saveOnCompactPhoto : undefined]}
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
export function PlaceCardAddress({ place }: { place: Parameters<typeof FormattedPlaceAddress>[0]['place'] }) {
  return <FormattedPlaceAddress place={place}>{address => address.trim() ?
    <View testID="place-card-address-row" style={styles.addressRow}>
      <MaterialIcon name="location" size={16} color="accent.primary" />
      <Text testID="place-card-meta" style={styles.addressText} variant="introSmall" color="text.secondary"
        numberOfLines={2} ellipsizeMode="tail" accessibilityLabel={address}>{address}</Text>
    </View> : null}</FormattedPlaceAddress>
}

export function PlaceCardTags({ tags = [] }: { tags?: readonly string[] }) {
  return tags.length ? <View style={styles.discoveryTags}>{[...new Set(tags)].map(tag => <Chip key={tag} label={tag} appearance="soft" />)}</View> : null
}

export function PlaceCardPhotoChips({ place, categoryLabel, inline = false }: { place: PlaceCardModel; categoryLabel?: string; inline?: boolean }) {
  const { t } = useTranslation()
  const open = useOpenLabel(place, true)
  const distance = formatDistance(place.distanceM)
  if (!open && !categoryLabel && !distance) return null
  return <View testID="place-card-photo-badges" pointerEvents="none" style={inline ? styles.discoveryTags : styles.photoBadges}>
    {distance ? <View style={styles.photoBadge}><MaterialIcon name="nearMe" size={14} color="text.secondary" /><Text numberOfLines={1} ellipsizeMode="tail" style={styles.photoBadgeText} variant="introCaptionMedium" color="text.secondary" accessibilityLabel={t('saved.straightDistance', { distance })}>{distance}</Text></View> : null}
    {open ? <View testID="place-card-hours-badge" style={styles.photoBadge}>
      {open.open ? <View style={styles.openDot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.photoBadgeText} variant="introCaptionMedium" color={open.open ? 'status.successText' : 'text.secondary'}>{open.label}</Text>
    </View> : null}
    {categoryLabel ? <View style={styles.photoBadge}><Text numberOfLines={1} ellipsizeMode="tail" style={styles.photoBadgeText} variant="introCaptionMedium" color="text.secondary">{categoryLabel}</Text></View> : null}
  </View>
}

function CanonicalPlaceCard({ place, variant = 'list', showPhoto = true, appearance = 'default', onPress, tags,
  saved, onToggleSave, style, headerAction, unavailableLabel, footer, photoCategoryLabel, contributionBadge }: PlaceCardProps) {
  const { t, i18n } = useTranslation()
  const { price } = placeCardRatingPriceLine(place, unit => t(priceUnitKey(unit)), i18n.language)
  const canSave = saved != null && onToggleSave != null
  const Target = onPress ? Pressable : View
  return <View testID="place-card-surface" style={[styles.discoveryCard, style]}>
    <Target testID="place-card-open-target" accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? place.name : undefined} onPress={onPress}>
      <View testID={appearance === 'saved' ? 'place-card-saved' : appearance === 'discovery' ? 'place-card-discovery' : 'place-card'} style={variant === 'compact' ? styles.compactCard : undefined}>
        {showPhoto ? <View style={[variant === 'compact' ? styles.compactCardPhoto : variant === 'hero' ? styles.heroPhoto : styles.listPhoto, unavailableLabel ? styles.unavailablePhoto : undefined]}>
          <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
          {place.discovery?.verified === true ? <View style={styles.verifiedBadge}><MaterialIcon name="verified" size={14} color="text.inverse" /><Text variant="introCaptionMedium" color="text.inverse">{t('discovery.verified')}</Text></View> : null}
          <PlaceCardPhotoChips place={place} categoryLabel={photoCategoryLabel ?? place.discovery?.categoryLabel} />
          {contributionBadge ? <View style={styles.contributionBadge}>{contributionBadge}</View> : null}
        </View> : null}
        <View style={[styles.listBody, variant === 'compact' ? styles.compactCopy : undefined]}>
          <View style={styles.discoveryHead}>
            {place.name ? <Text testID="place-card-name" variant="discoveryHeading" color="text.primary" style={[styles.discoveryName, unavailableLabel ? styles.unavailableName : undefined]} numberOfLines={1} ellipsizeMode="tail">{place.name}</Text> : null}
            {price ? <Text testID="place-card-price" variant="introLabel" color="accent.primary" style={styles.discoveryPrice}>{price}</Text> : null}
          </View>
          <PlaceCardAddress place={place} />
          <RatingChips place={place} />
          {!showPhoto ? <PlaceCardPhotoChips place={place} categoryLabel={photoCategoryLabel ?? place.discovery?.categoryLabel} inline /> : null}
          {unavailableLabel ? <Text variant="bodySmall" color="status.warningText">{unavailableLabel}</Text> : null}
          <PlaceCardTags tags={tags ?? place.discovery?.tagLabels} />
        </View>
      </View>
    </Target>
    {headerAction ?? (canSave ? <SaveToggle saved={saved} onToggle={onToggleSave} compact={variant === 'compact'} /> : null)}
    {place.photoAttribution ? <Text testID="saved-photo-attribution" variant="caption" color="text.secondary" style={styles.savedCredits}>{place.photoSource === 'google' ? 'Google · ' : ''}{place.photoAttribution}{place.photoAuthors?.map((author, index) => <Text key={`${index}-${author.displayName}`} variant="caption" accessibilityRole={author.uri ? 'link' : undefined} onPress={author.uri ? () => { void openWebsite(author.uri!) } : undefined}> · {author.displayName}</Text>)}</Text> : null}
    {footer ? <View style={styles.savedFooter}>{footer}</View> : null}
  </View>
}

/** A resolved provider identity has no canonical GoGo ID or canonical place actions. */
export interface PlacePreviewProps {
  variant: 'preview'
  compact?: boolean
  preview: NonNullable<ResolveLinkResult['candidate']>
  categoryLabel?: string | null
  children?: ReactNode
  headerAction?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function PlaceCard(props: PlaceCardProps | PlacePreviewProps) {
  return 'preview' in props ? <PreviewCard {...props} /> : <CanonicalPlaceCard {...props} />
}

function PreviewCard({ preview, compact, categoryLabel, children, headerAction, style }: PlacePreviewProps) {
  const { t } = useTranslation()
  const now = usePlaceClock()
  const candidatePhoto = useCandidatePhoto(preview)
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const photo = candidatePhoto.photo?.uri !== failedPhoto ? candidatePhoto.photo : null
  const open = openStateFromHours(preview.openingHours, now)
  const hours = preview.openingHours ?? []
  const daily = hours.length === 7 && new Set(hours.map(hour => hour.dayOfWeek)).size === 7
    && hours.every(hour => hour.openMinute === hours[0].openMinute && hour.closeMinute === hours[0].closeMinute && hour.isOvernight === hours[0].isOvernight)
  const schedule = (daily ? hours.slice(0, 1) : hours).map(hour =>
    `${formatMinuteOfDay(hour.openMinute)}–${formatMinuteOfDay(hour.closeMinute)} ${t(daily ? 'placeImport.daily' : `common.weekday.${hour.dayOfWeek}`)}`,
  ).join(' · ')
  const opens = formatMinuteOfDay(open.opensAtMinute)
  const openLabel = open.openNow == null ? null : open.openNow
    ? `${t('common.open')} · ${schedule}`
    : opens ? t(open.opensDayOffset === 1 ? 'discovery.closedTomorrow' : (open.opensDayOffset ?? 0) > 1 ? 'discovery.closedLater' : 'search.closedOpens', { time: opens, days: open.opensDayOffset }) : t('common.closed')
  const photoCredit = photo ? `${t('placeImport.photoCredit')}${photo.authors.map(author => author.displayName).join(', ')} · ${photo.attribution}` : undefined
  const hasPhoto = candidatePhoto.status === 'loading' || !!photo
  if (compact) return (
    <View testID="place-preview-compact" style={[styles.compactRow, style]}>
      {photo ? <Image testID="place-preview-thumbnail" source={{ uri: photo.uri }} style={styles.compactPhoto}
        contentFit="cover" cachePolicy="none" onError={() => setFailedPhoto(photo.uri)} accessibilityIgnoresInvertColors /> : null}
      <View style={styles.compactCopy}>
        <Text variant="label" numberOfLines={1}>{preview.name}</Text>
        <PlaceCardAddress place={{ addressText: preview.address }} />
        {photo ? <Text variant="caption" color="text.secondary">
          {t('placeImport.photoCredit')}{photo.authors.map((author, index) => <Text key={`${index}-${author.displayName}`} variant="caption" color="text.secondary" accessibilityRole={author.uri ? 'link' : undefined} onPress={author.uri ? () => { void openWebsite(author.uri!) } : undefined}>{index ? ', ' : ''}{author.displayName}</Text>)} · {photo.attribution}
        </Text> : null}
      </View>
    </View>
  )
  return (
    <View style={style}>
      <View testID="import-preview-card" style={styles.importCard}>
        {hasPhoto ? <View testID="import-preview-photo-frame" style={styles.listPhoto}>
          {candidatePhoto.status === 'loading' ? (
            <View testID="import-candidate-photo-loading" style={styles.photoSkeleton} accessible accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
              <Skeleton style={styles.photoSkeleton} />
            </View>
          ) : null}
          {photo ? <Image testID="import-candidate-photo" source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="none" onError={() => setFailedPhoto(photo.uri)} accessible accessibilityLabel={preview.name} /> : null}
          {headerAction ? <View style={styles.importHeaderAction}>{headerAction}</View> : null}
          <View testID="import-photo-overlays" style={styles.importPhotoOverlays}>
            {photo ? <Text testID="import-photo-credit" numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={photoCredit} variant="introCaption" color="text.inverse" style={styles.importPhotoCredit}>
              {t('placeImport.photoCredit')}{photo.authors.map((author, index) => <Text key={`${index}-${author.displayName}`} variant="introCaption" color="text.inverse" accessibilityRole={author.uri ? 'link' : undefined} onPress={author.uri ? () => { void openWebsite(author.uri!) } : undefined}>{index ? ', ' : ''}{author.displayName}</Text>)} · {photo.attribution}
            </Text> : null}
          </View>
        </View> : null}
        <View style={styles.importBody}>
          {!hasPhoto && headerAction ? <View style={styles.importNoPhotoHead}>{headerAction}</View> : null}
          <View style={styles.listHead}>
            <Text variant="introSection" color="text.primary">{preview.name}</Text>
            <PlaceCardAddress place={{ addressText: preview.address }} />
          </View>
          {categoryLabel ? <Text variant="introSmall" color="text.secondary">{categoryLabel}</Text> : null}
          {preview.googleRating != null || openLabel ? <View style={styles.importFacts}>
            {preview.googleRating != null ? <GoogleRatingBadge value={preview.googleRating} count={preview.googleRatingCount ?? undefined} /> : null}
            {openLabel ? <View testID="import-body-hours" style={styles.importFact}><Text variant="introSmall" color={open.openNow ? 'status.successText' : 'status.dangerText'}>●</Text><Text variant="introSmall" color="text.secondary" style={styles.importHoursLabel}>{openLabel}</Text></View> : null}
          </View> : null}
          {[...new Set(preview.attributions ?? [])].filter(attribution => !photo || attribution.trim() !== photo.attribution.trim()).map(attribution => <Text key={attribution} variant="introCaption" color="text.secondary">{attribution}</Text>)}
        </View>
      </View>
      {children ? <View style={styles.importActions}>{children}</View> : null}
    </View>
  )
}
