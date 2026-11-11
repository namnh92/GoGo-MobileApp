import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import {
  toPlaceCard, useDiscoveryPreview, usePlaceSearch,
  type PlaceCard, type PlaceSearchQuery,
} from '@/shared/api'
import { formatMoney } from '@/shared/pricing/money'
import { MaterialIcon, type MaterialIconName } from '@/shared/ui/material-icon'
import { PlaceCardSmall } from '@/shared/ui/place-card-small.view'
import { Text } from '@/shared/ui/text'
import { emptyFilters, filterParams, validateFilters, type DiscoveryFilters } from './discovery-filters'
import { styles } from './search.style'

type Relaxation = { id: string; filters: DiscoveryFilters; title: string; icon: MaterialIconName; apply?: boolean }

/** OR groups must be removed as a whole; removing a member would narrow them. */
function relaxations(filters: DiscoveryFilters, t: ReturnType<typeof useTranslation>['t']): Relaxation[] {
  const candidates: Relaxation[] = []
  if (filters.priceTo.trim()) {
    const budget = Math.max(50, Math.ceil(Number(filters.priceTo.replace(',', '.')) * 1.5))
    const next = { ...filters, priceTo: String(budget) }
    if (validateFilters(next)) candidates.push({ id: 'budget', filters: next, title: t('discovery.relaxBudget', { budget: formatMoney(budget * 1000) }), icon: 'payments', apply: true })
  } else if (Number(filters.priceFrom.replace(',', '.')) > 0) {
    candidates.push({ id: 'priceFrom', filters: { ...filters, priceFrom: '' }, title: t('discovery.relaxMinimum'), icon: 'payments' })
  }
  if (filters.openNow) candidates.push({ id: 'openNow', filters: { ...filters, openNow: false }, title: t('discovery.relaxCriterion', { criterion: t('discovery.openNow') }), icon: 'clock' })
  for (const [field, label] of [['amenities', t('discovery.amenities')], ['moods', t('discovery.moods')], ['settings', t('discovery.settings')], ['suited', t('search.filterSuited')], ['categories', t('search.filterCategory')]] as const) {
    if (filters[field].length) candidates.push({ id: field, filters: { ...filters, [field]: [] }, title: t('discovery.relaxCriterion', { criterion: label }), icon: 'filterOff' })
  }
  return candidates.slice(0, 3)
}

function useRelaxCount(candidate: Relaxation | undefined, query: PlaceSearchQuery) {
  const preview = useDiscoveryPreview({ ...query, ...filterParams(candidate?.filters ?? emptyFilters()) }, !!candidate)
  const count = candidate && preview.isSuccess && (preview.isFetchedAfterMount || preview.isStale === false) && !preview.isFetching && !preview.isPaused && !preview.isPlaceholderData ? preview.data?.meta?.totalCount : undefined
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? count : undefined
}

export function SearchEmpty({ filters, query, onApply, onMore, onPlacePress, labels }: {
  filters: DiscoveryFilters
  /** Scope, locale and keyword only; no committed filter dimensions. */
  query: PlaceSearchQuery
  onApply: (filters: DiscoveryFilters) => void
  onMore: () => void
  onPlacePress: (place: PlaceCard) => void
  labels: Parameters<typeof toPlaceCard>[1]
}) {
  const { t } = useTranslation()
  const candidates = relaxations(filters, t)
  // Pause optional reads while editing; remount with the complete search key.
  const counts = [useRelaxCount(candidates[0], query), useRelaxCount(candidates[1], query), useRelaxCount(candidates[2], query)]
  const visible = candidates.flatMap((candidate, index) => counts[index] === undefined ? [] : [{ ...candidate, count: counts[index]! }])
  const { q: _keyword, ...nearbyScope } = query
  const hasScope = (nearbyScope.lat != null && nearbyScope.lng != null) || !!nearbyScope.provinceCode
  const nearby = usePlaceSearch({ ...nearbyScope, limit: 2 }, { enabled: hasScope })
  const places = hasScope && nearby.isSuccess && (nearby.isFetchedAfterMount || nearby.isStale === false) && !nearby.isFetching && !nearby.isPaused && !nearby.isPlaceholderData
    ? (nearby.data?.pages[0]?.results ?? []).slice(0, 2).map(result => toPlaceCard(result, labels)) : []
  return <View testID="search-empty-content" style={styles.emptyContent}>
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialIcon name="travelExplore" size={38} color="accent.text" />
        <View testID="search-filter-off-badge" style={styles.emptyIconBadge}><MaterialIcon name="filterOff" size={18} color="status.infoText" /></View>
      </View>
      <Text variant="discoveryHeading" color="text.primary" style={styles.centerText}>{t('discovery.emptyTitle')}</Text>
      <Text variant="introCaption" color="text.secondary" style={styles.emptyHint}>{t('discovery.emptyBody')}</Text>
    </View>
    {visible.length ? <View testID="search-relaxations" style={styles.relaxBlock}>
      <View style={styles.relaxHeading}><MaterialIcon name="sparkle" size={18} color="accent.text" /><Text variant="introLabel" color="text.primary">{t('discovery.relaxTitle')}</Text></View>
      {visible.map(candidate => <View key={candidate.id} style={styles.relaxRow}>
        <MaterialIcon name={candidate.icon} size={18} color="accent.text" />
        <View style={styles.relaxCopy}>
          <Text variant="introSmall" color="text.primary">{candidate.title}</Text>
          <Text variant="introCaptionMedium" color="status.successText">{t('discovery.relaxCount', { count: candidate.count })}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t(candidate.apply ? 'discovery.relaxApply' : 'discovery.relaxRemove')}: ${candidate.title}`} onPress={() => onApply(candidate.filters)} style={styles.relaxActionTarget}>
          <View style={[styles.relaxAction, candidate.apply && styles.relaxApply]}><Text variant="introCaptionMedium" color={candidate.apply ? 'accent.text' : 'text.primary'}>{t(candidate.apply ? 'discovery.relaxApply' : 'discovery.relaxRemove')}</Text></View>
        </Pressable>
      </View>)}
    </View> : null}
    {places.length ? <View testID="search-nearby" style={styles.nearby}>
      <View style={styles.nearbyHeading}><Text variant="introLabel" color="text.primary" style={styles.relaxCopy}>{t('discovery.nearbyTitle')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('discovery.more')} onPress={onMore} style={styles.moreTarget}><Text variant="introCaptionMedium" color="accent.text">{t('discovery.more')}</Text></Pressable></View>
      {places.map(place => <NearbyPlace key={place.id} place={place} onPress={() => onPlacePress(place)} />)}
    </View> : null}
  </View>
}

function NearbyPlace({ place, onPress }: { place: PlaceCard; onPress: () => void }) {
  return <View testID="search-nearby-place"><PlaceCardSmall place={place} onPress={onPress} /></View>
}
