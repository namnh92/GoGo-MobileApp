import type { RoutingHold } from '@/shared/navigation/routing-hold'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { type RoomSummary, type usePlaceDetail, useSeedPlaceDetails, useTaxonomies, detailToPlaceCard, discoveryLabels, roomCapabilities, useRemoveRoomSeedPlace } from '@/shared/api'
import { clearPickerScope, draftPickerScope, savePickerScope } from '@/shared/location/picker-scope'
import { Card, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { PlaceCardSmall, type PlaceCardSmallProps } from '@/shared/ui/place-card-small.view'
import { Text } from '@/shared/ui/text'
import { Icon } from '@/shared/ui/icons'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { styles } from './room-seeds.style'
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
  return <PlaceCardSmall {...props}
    loading={detail.isFetching || detail.isPending}
    caption={detail.isError && !detail.isFetching ? <GhostBtn size="small" label={t('common.retry')} onPress={() => void detail.refetch()} /> : undefined} />
}


export function RoomSeeds({ room, details, onRefresh, hold }: {
  room: RoomSummary; details: ReturnType<typeof useSeedPlaceDetails>; onRefresh: () => Promise<unknown>; hold?: RoutingHold['hold']
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const isHost = roomCapabilities(room).isHost
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
  const seeds = (room.seedPlaces ?? []).flatMap(seed => seed.placeId && seed.name ? [{ placeId: seed.placeId, name: seed.name }] : [])
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
    <Card testID="room-lobby-seeds" style={styles.card}>
      <View style={styles.heading}>
        <Icon name="mapPin" size={20} color="accent.primary" />
        <Text variant="discoveryHeading" accessibilityRole="header" style={styles.title}>{t('roomManage.seedTitle')}</Text>
        {isHost ? <IconBtn testID="room-lobby-seeds-add" accessibilityLabel={t('roomManage.addSeedPlaces')} style={styles.add}
          disabled={!scope || pickerOpening} onPress={() => {
            if (!scope || opening.current) return
            opening.current = true; setPickerOpening(true)
            clearPickerScope(scopeId.current)
            scopeId.current = savePickerScope(scope)
            router.push({ pathname: '/places/search', params: { picker: '1', roomId: room.id, pickerScope: scopeId.current } })
          }}><Icon name="plus" size={20} color="accent.primary" /></IconBtn> : null}
      </View>
      <Text variant="bodySmall" color="text.secondary">{t(seeds.length ? 'createPlaces.body' : 'roomSeeds.empty')}</Text>
      {seeds.map(seed => <SeedPlaceCard key={seed.placeId} {...seed} detail={details.byPlaceId.get(seed.placeId)!}
        onRemove={isHost ? () => { if (!lock.current) { setFailed(false); setTarget(seed) } } : undefined} />)}
      {isHost && !scope ? <Text variant="bodySmall" color="text.secondary">{t('roomManage.seedScopeUnavailable')}</Text> : null}
    </Card>
    <ResultSheet visible={!!target && isHost} variant="warning" testID="room-lobby-seed-confirm"
      title={t('roomSeeds.removeTitle')} body={t('roomSeeds.removeBody', { name: target?.name ?? '' })}
      note={failed ? t('roomManage.saveFailed') : undefined}
      secondaryAction={{ label: t('common.cancel'), onPress: dismiss, disabled: busy }}
      primaryAction={{ label: t('roomManage.removeConfirm'), destructive: true, loading: busy, disabled: busy, onPress: confirm }} onClose={dismiss} />
  </>
}
