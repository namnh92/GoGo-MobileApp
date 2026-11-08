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
import { MaterialIcon } from './material-icon'
import { Text } from '@/shared/ui/text'
import { RatingChips, GoogleRatingBadge } from './rating-chips.view'

import { usePlaceClock } from './use-place-clock'
import { styles } from './place-card.style'
import { Skeleton } from './skeleton.view'

/** One place presentation across features. Geometry varies; fact styles do not. */
export type PlaceCardVariant = 'list' | 'hero' | 'compact' | 'nearby' | 'saved' | 'saved-city' | 'contribution'
  | 'assistant' | 'plan-stop' | 'plan-edit' | 'active' | 'next-stop' | 'swipe' | 'match' | 'match-group' | 'shared-result'

export interface PlaceCardProps {
  place: PlaceCardModel
  appearance?: 'default' | 'discovery' | 'saved' | 'contribution'
  contributionBadge?: ReactNode
  headerAction?: ReactNode
  unavailableLabel?: string
  photoCategoryLabel?: string
  footer?: ReactNode
  /** Feature-owned controls; place facts remain inside PlaceCard. */
  photoOverlay?: ReactNode
  bodyLeading?: ReactNode
  bodyTrailing?: ReactNode
  headingAction?: ReactNode
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
export function PlaceCardAddress({ place, compact = false, inverse = false, pin = true, overlay = false }: {
  place: Parameters<typeof FormattedPlaceAddress>[0]['place']; compact?: boolean; inverse?: boolean; pin?: boolean; overlay?: boolean
}) {
  return <FormattedPlaceAddress place={place}>{address => address.trim() ?
    <View testID="place-card-address-row" style={[styles.addressRow, overlay && styles.assistantPhotoAddress]}>
      {pin ? <MaterialIcon name="location" size={compact ? 13 : 16} color={inverse ? 'text.inverse' : 'accent.primary'} /> : null}
      <Text testID="place-card-meta" style={styles.addressText} variant={compact ? 'introCaption' : 'introSmall'} color={inverse ? 'text.inverse' : 'redesign.secondary'}
        numberOfLines={compact ? 1 : 2} ellipsizeMode="tail" accessibilityLabel={address}>{address}</Text>
    </View> : null}</FormattedPlaceAddress>
}

/** Informational tags have no 44pt action target: Stitch draws caption pills. */
export function PlaceCardTags({ tags = [] }: { tags?: readonly string[] }) {
  return tags.length ? <View testID="place-card-tags" style={styles.discoveryTags}>{[...new Set(tags)].map(tag =>
    <View key={tag} style={styles.factTag}><Text variant="introCaption" color="redesign.secondary">{tag}</Text></View>)}</View> : null
}

function Verified({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation()
  return <View testID="place-card-verified" style={inline ? styles.inlineVerified : styles.verifiedBadge}>
    <MaterialIcon name="verified" size={inline ? 12 : 14} color={inline ? 'redesign.greenText' : 'text.inverse'} />
    <Text variant="introCaptionMedium" color={inline ? 'redesign.greenText' : 'text.inverse'}>{t('discovery.verified')}</Text>
  </View>
}

export function PlaceCardPhotoChips({ place, categoryLabel, inline = false, mode = 'default' }: {
  place: PlaceCardModel; categoryLabel?: string; inline?: boolean; mode?: 'default' | 'saved' | 'saved-city' | 'nearby'
}) {
  const { t } = useTranslation()
  const open = useOpenLabel(place, true)
  const distance = mode === 'saved' ? null : formatDistance(place.distanceM)
  const nearby = mode === 'nearby'
  const inverse = mode !== 'default'
  if (nearby ? !distance : !open && !categoryLabel && !distance) return null
  return <View testID="place-card-photo-badges" pointerEvents="none" style={inline ? styles.discoveryTags : nearby ? styles.nearbyDistance : mode === 'saved' ? styles.savedTopBadges : mode === 'saved-city' ? styles.savedPhotoBadges : styles.photoBadges}>
    {distance ? <View style={[styles.photoBadge, inverse && styles.inverseBadge, nearby && styles.smallBadge]}>
      {!nearby ? <MaterialIcon name="nearMe" size={14} color={inverse ? 'text.inverse' : 'accent.primary'} /> : null}
      <Text style={styles.photoBadgeText} variant="introCaptionMedium" color={inverse ? 'text.inverse' : 'redesign.secondary'} accessibilityLabel={t('saved.straightDistance', { distance })}>{distance}</Text>
    </View> : null}
    {!nearby && open ? <View testID="place-card-hours-badge" style={[styles.photoBadge, inverse && styles.inverseBadge]}>
      {open.open ? <View style={styles.openDot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
      <Text style={styles.photoBadgeText} variant="introCaptionMedium" color={inverse ? 'text.inverse' : open.open ? 'redesign.greenText' : 'redesign.secondary'}>{open.label}</Text>
    </View> : null}
    {categoryLabel && !nearby ? <View style={[styles.photoBadge, inverse && styles.inverseBadge]}><Text style={styles.photoBadgeText} variant="introCaption" color={inverse ? 'text.inverse' : 'redesign.secondary'}>{categoryLabel}</Text></View> : null}

  </View>
}

function CanonicalPlaceCard({ place, variant, showPhoto = true, appearance = 'default', onPress, tags,
  saved, onToggleSave, style, headerAction, unavailableLabel, footer, photoCategoryLabel, contributionBadge,
  photoOverlay, bodyLeading, bodyTrailing, headingAction }: PlaceCardProps) {
  const { t, i18n } = useTranslation()
  const layout = variant ?? (appearance === 'saved' ? 'saved' : appearance === 'contribution' ? 'contribution' : 'list')
  const nearby = layout === 'nearby'
  const row = nearby || layout === 'compact' || layout === 'plan-edit' || layout === 'next-stop'
  const overlayTitle = layout === 'plan-stop' || layout === 'hero'
  const contribution = layout === 'contribution'
  const savedLayout = layout === 'saved' || layout === 'saved-city'
  const lean = contribution || layout === 'plan-edit' || layout === 'shared-result'
  const { price } = placeCardRatingPriceLine(place, unit => t(priceUnitKey(unit)), i18n.language)
  const canSave = saved != null && onToggleSave != null
  const Target = onPress ? Pressable : View
  const name = <Text testID="place-card-name" variant={nearby ? 'introLabel' : layout === 'next-stop' || layout === 'plan-edit' ? 'title2' : overlayTitle ? 'title1' : 'discoveryHeading'} color={overlayTitle || layout === 'shared-result' ? 'text.inverse' : 'redesign.ink'} style={[styles.discoveryName, unavailableLabel ? styles.unavailableName : undefined]} numberOfLines={savedLayout ? 2 : 1} ellipsizeMode="tail">{place.name}</Text>
  const address = <PlaceCardAddress place={place} compact={row || savedLayout || overlayTitle} inverse={overlayTitle || layout === 'shared-result'} pin={!nearby && !savedLayout && !contribution} />
  const priceNode = price ? <Text testID="place-card-price" variant={nearby ? 'introCaption' : 'introLabel'} color={nearby ? 'redesign.secondary' : 'accent.primary'} style={styles.discoveryPrice}>{price}</Text> : null
  const photoStyle = nearby || layout === 'compact' || layout === 'next-stop' ? styles.thumbnailPhoto
    : layout === 'plan-edit' ? styles.editorPhoto
    : layout === 'saved' ? styles.savedListPhoto : savedLayout || contribution ? styles.savedPhoto
    : layout === 'plan-stop' ? styles.planPhoto
    : layout === 'active' ? styles.activePhoto
    : layout === 'swipe' ? styles.swipePhoto
    : layout === 'shared-result' ? styles.sharePhoto : layout === 'hero' ? styles.heroPhoto : styles.listPhoto
  const titleAndAddress = <View testID="place-card-heading" style={styles.headingCopy}>{place.name ? name : null}{layout !== 'plan-edit' ? address : null}</View>
  return <View testID="place-card-surface" style={[styles.discoveryCard, row && styles.rowSurface, (layout === 'plan-edit' || layout === 'next-stop') && styles.plainRowSurface, savedLayout && styles.savedCard, contribution && styles.contributionCard, layout === 'shared-result' && styles.resultCard, layout === 'match-group' && styles.groupCard, style]}>
    <Target testID="place-card-open-target" accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? place.name : undefined} onPress={onPress}>
      <View testID={appearance === 'saved' ? 'place-card-saved' : appearance === 'discovery' ? 'place-card-discovery' : 'place-card'} style={row ? styles.compactCard : undefined}>
        {showPhoto ? <View testID="place-card-photo" style={[photoStyle, unavailableLabel ? styles.unavailablePhoto : undefined]}>
          <PlacePhoto placeId={place.id} name={place.name} uri={place.photoUrl} style={StyleSheet.absoluteFill} />
          {overlayTitle ? <View pointerEvents="none" style={styles.heroScrim} /> : null}
          {!row && !lean && !savedLayout && layout !== 'active' && place.discovery?.verified === true ? <Verified /> : null}
          {!lean && !overlayTitle && (!row || nearby) && layout !== 'assistant' ? <PlaceCardPhotoChips place={place} categoryLabel={layout === 'saved-city' || layout === 'swipe' ? photoCategoryLabel ?? place.discovery?.categoryLabel : undefined} mode={nearby ? 'nearby' : layout === 'saved-city' ? 'saved-city' : savedLayout ? 'saved' : 'default'} /> : null}
          {layout === 'assistant' ? <PlaceCardAddress place={place} compact inverse overlay /> : null}
          {contributionBadge ? <View style={styles.contributionBadge}>{contributionBadge}</View> : null}
          {photoOverlay}
          {overlayTitle ? <View testID="place-card-overlay-heading" style={styles.heroBody}>{titleAndAddress}</View> : null}
        </View> : null}
        <View testID="place-card-body" style={[styles.listBody, row && styles.compactCopy, savedLayout && styles.savedBody, layout === 'hero' && styles.heroFacts]}>
          {nearby && place.discovery?.verified ? <Verified inline /> : null}
          {layout === 'plan-edit' ? <View style={styles.editorLeading}>{bodyLeading}<RatingChips place={place} compact /></View> : bodyLeading}
          {!overlayTitle || !showPhoto ? <View testID="place-card-title-row" style={nearby || lean || savedLayout || layout === 'match-group' ? styles.headingCopy : styles.discoveryHead}>
            {layout === 'assistant' && showPhoto ? <View style={styles.headingCopy}>{name}</View> : titleAndAddress}
            {!nearby && !lean && !savedLayout ? priceNode : null}
            {headingAction}
          </View> : null}
          {!lean ? <View testID={layout === 'saved' ? 'place-card-rating-price-row' : undefined} style={layout === 'saved' ? styles.ratingPriceRow : undefined}>
            <RatingChips place={place} compact={nearby || layout === 'next-stop'} />{layout === 'saved' ? priceNode : null}
          </View> : null}
          {nearby ? priceNode : null}
          {!showPhoto && !lean && !nearby ? <PlaceCardPhotoChips place={place} inline /> : null}
          {unavailableLabel ? <Text variant="bodySmall" color="status.warningText">{unavailableLabel}</Text> : null}
          {!lean && !nearby ? <View testID={savedLayout ? 'place-card-taxonomy-row' : undefined} style={layout === 'saved-city' ? styles.savedTaxonomyRow : undefined}>
            <PlaceCardTags tags={tags ?? place.discovery?.tagLabels} />{layout === 'saved-city' ? priceNode : null}
          </View> : null}
          {bodyTrailing}
        </View>
      </View>
    </Target>
    {headerAction ?? (canSave ? <SaveToggle saved={saved} onToggle={onToggleSave} compact={row} /> : null)}
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
