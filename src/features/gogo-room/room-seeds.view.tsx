import type { RoutingHold } from '@/shared/navigation/routing-hold'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, FlatList, View, useWindowDimensions } from 'react-native'
import { type RoomSummary, type usePlaceDetail, useSeedPlaceDetails, useTaxonomies, detailToPlaceCard, discoveryLabels, roomCapabilities, useRemoveRoomSeedPlace } from '@/shared/api'
import { clearPickerScope, draftPickerScope, savePickerScope } from '@/shared/location/picker-scope'
import { Card, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { PlaceCardSmall, type PlaceCardSmallProps } from '@/shared/ui/place-card-small.view'
import { Text } from '@/shared/ui/text'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { spacing } from '@/shared/ui/tokens'
import { MAX_SEED_PLACES } from '@/shared/store/roomStore'
import { canSuggestPlaces, recenterSeedIndex, seedIndex } from './room-seeds.model'
import { styles } from './room-seeds.style'
import { styles as sectionStyles } from './room-section.style'
import { RoomSectionHeading, RoomSectionDescription } from './room-section.view'
/** One cached detail query per seed; unknown/loading/error facts stay omitted. */
function SeedPlaceCard({ placeId, name, detail, onRemove }: {
  placeId: string; name: string
  detail: ReturnType<typeof usePlaceDetail>
  onRemove?: () => void
}) {
  const { t, i18n } = useTranslation()
  const taxonomy = useTaxonomies({ kinds: 'category,mood,setting,amenity,suitability' })
  const fallback = { id: placeId, name }
  const place = detailToPlaceCard(
    detail.isError ? fallback : detail.data ?? fallback,
    discoveryLabels(taxonomy.data, i18n.language),
  )
  const props: PlaceCardSmallProps = onRemove ? { place, onRemove, removeAccessibilityLabel: t('roomSeeds.removeLabel', { name }) } : { place }
  return <PlaceCardSmall {...props} focusable
    loading={detail.isFetching || detail.isPending}
    caption={detail.isError && !detail.isFetching ? <GhostBtn size="small" label={t('common.retry')} onPress={() => void detail.refetch()} /> : undefined} />
}

/** Until both OS preferences are known, expose only the real seeds. */
function useSeedLoopEnabled() {
  const reduced = useReducedMotionPreference()
  const [screenReader, setScreenReader] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => {
      changed = true
      if (active) setScreenReader(enabled)
    })
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
      if (active && !changed) setScreenReader(enabled)
    }).catch(() => {})
    return () => { active = false; subscription.remove() }
  }, [])
  return reduced === false && screenReader === false
}


export function RoomSeeds({ room, details, onRefresh, hold }: {
  room: RoomSummary; details: ReturnType<typeof useSeedPlaceDetails>; onRefresh: () => Promise<unknown>; hold?: RoutingHold['hold']
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const isHost = roomCapabilities(room).isHost
  // No BE#878 capability in the current contract: members remain read-only.
  const canSuggest = canSuggestPlaces(room.myRole)
  const loopEnabled = useSeedLoopEnabled()
  const { width } = useWindowDimensions()
  const [rowWidth, setRowWidth] = useState<number | null>(null)
  const list = useRef<FlatList<{ placeId: string; name: string; virtualIndex: number }>>(null)
  const remove = useRemoveRoomSeedPlace(room.id)
  const [target, setTarget] = useState<{ placeId: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const lock = useRef(false)
  const scopeId = useRef<string | null>(null)
  const opening = useRef(false)
  const [pickerOpening, setPickerOpening] = useState(false)
  useFocusEffect(useCallback(() => { opening.current = false; setPickerOpening(false) }, []))
  useEffect(() => () => clearPickerScope(scopeId.current), [])
  useEffect(() => target ? hold?.() : undefined, [target, hold])
  const area = room.constraints?.administrativeArea
  const scope = area?.status === 'current' ? draftPickerScope({ administrativeArea: area, originLat: null, originLng: null, radiusM: null }) : null
  const seeds = (room.seedPlaces ?? []).flatMap(seed => seed.placeId && seed.name ? [{ placeId: seed.placeId, name: seed.name }] : []).slice(0, MAX_SEED_PLACES)
  // Measure the full-bleed row rather than sizing cards against the window.
  // Before layout, allow for the lobby's outer padding.
  const contentWidth = Math.max(0, (rowWidth ?? width - 2 * spacing[4]) - 2 * spacing[4])
  const cardWidth = Math.max(0, contentWidth - (seeds.length > 1 ? spacing[8] : 0))
  const stride = cardWidth + spacing[4]
  const atLimit = (room.seedPlaces?.length ?? 0) >= MAX_SEED_PLACES
  const limitHint = t('roomSeeds.limitHint', { max: MAX_SEED_PLACES })
  const looping = loopEnabled && seeds.length >= 2
  const row = Array.from({ length: seeds.length * (looping ? 3 : 1) }, (_, virtualIndex) => ({
    ...seeds[seedIndex(virtualIndex, seeds.length)!], virtualIndex,
  }))
  function dismiss() { if (!lock.current) setTarget(null) }
  function confirm() {
    if (!target || !isHost || lock.current) return
    lock.current = true; setBusy(true); setFailed(false)
    remove.mutate(target.placeId, {
      onSuccess: () => { setTarget(null); void onRefresh() }, onError: () => setFailed(true),
      onSettled: () => { lock.current = false; setBusy(false) },
    })
  }
  return <>
    <Card testID="room-lobby-seeds" style={sectionStyles.card}>
      <RoomSectionHeading icon="mapPin" title={t('roomManage.seedTitle')} compactAction={canSuggest ? actionStyle => <IconBtn style={actionStyle} variant="plainCompact" testID="room-lobby-seeds-add" accessibilityLabel={t('roomManage.addSeedPlaces')} accessibilityHint={atLimit ? limitHint : undefined}
          disabled={atLimit || !scope || pickerOpening} onPress={() => {
            if (atLimit || !canSuggest || !scope || opening.current) return
            opening.current = true; setPickerOpening(true)
            clearPickerScope(scopeId.current)
            scopeId.current = savePickerScope(scope)
            router.push({ pathname: '/places/search', params: { picker: '1', roomId: room.id, pickerScope: scopeId.current } })
          }}><MaterialIcon name="plus" size={20} color="accent.primary" /></IconBtn> : undefined} />
      <View style={styles.rows}><RoomSectionDescription>{t(seeds.length ? 'roomSeeds.body' : 'roomSeeds.empty')}</RoomSectionDescription>
      {seeds.length ? <View><FlatList ref={list} testID="room-lobby-seeds-list"
        key={`${room.id}:${seeds.map(seed => seed.placeId).join(',')}:${looping}:${cardWidth}`}
        horizontal data={row} style={styles.row} contentContainerStyle={styles.rowContent}
        onLayout={event => setRowWidth(event.nativeEvent.layout.width)}
        accessibilityRole="list" accessibilityLabel={t('roomManage.seedTitle')}
        keyExtractor={item => `${item.placeId}:${item.virtualIndex}`}
        showsHorizontalScrollIndicator={false} scrollEnabled={seeds.length > 1}
        initialScrollIndex={looping ? seeds.length : 0} initialNumToRender={row.length}
        // Scroll by whole strides, leaving the leading content padding visible
        // at initial positioning, snapping and silent loop recentering.
        getItemLayout={(_, index) => ({ length: stride, offset: stride * index, index })}
        snapToInterval={stride} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
        ItemSeparatorComponent={SeedSeparator}
        onMomentumScrollEnd={event => {
          if (!looping) return
          const index = Math.round(event.nativeEvent.contentOffset.x / stride)
          const centered = recenterSeedIndex(index, seeds.length)
          if (centered !== index) list.current?.scrollToOffset({ offset: centered * stride, animated: false })
        }}
        renderItem={({ item }) => {
          const duplicate = looping && (item.virtualIndex < seeds.length || item.virtualIndex >= seeds.length * 2)
          return <View testID="room-lobby-seed-item" style={{ width: cardWidth }}
            accessibilityElementsHidden={duplicate} importantForAccessibility={duplicate ? 'no-hide-descendants' : 'auto'}>
            <SeedPlaceCard {...item} detail={details.byPlaceId.get(item.placeId)!}
              onRemove={isHost ? () => { if (!lock.current) { setFailed(false); setTarget(item) } } : undefined} />
          </View>
        }} />
        {/* Keep the preceding loop copy's overlapping badge out of the leading inset. */}
        <View testID="room-lobby-seeds-leading-inset" pointerEvents="none" style={styles.leadingInset} />
      </View> : null}
      {canSuggest && atLimit ? <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">{limitHint}</Text> : null}
      {canSuggest && !scope ? <Text variant="bodySmall" color="text.secondary">{t('roomManage.seedScopeUnavailable')}</Text> : null}
      </View>
    </Card>
    <ResultSheet visible={!!target && isHost} variant="warning" testID="room-lobby-seed-confirm"
      title={t('roomSeeds.removeTitle')} body={t('roomSeeds.removeBody', { name: target?.name ?? '' })}
      note={failed ? t('roomManage.saveFailed') : undefined}
      secondaryAction={{ label: t('common.cancel'), onPress: dismiss, disabled: busy }}
      primaryAction={{ label: t('roomManage.removeConfirm'), destructive: true, loading: busy, disabled: busy, onPress: confirm }} onClose={dismiss} />
  </>
}

function SeedSeparator() { return <View style={styles.separator} /> }
