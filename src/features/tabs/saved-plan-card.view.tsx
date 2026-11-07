import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { detailToPlaceCard, parseApiDate, usePlaceDetail, useRoom, type Plan, type PlanStop } from '@/shared/api'
import { Card, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Text } from '@/shared/ui/text'
import { orderedSavedStops } from './saved-facts'
import { styles } from './saved-plan-card.style'

function Stop({ stop }: { stop: PlanStop }) {
  const { i18n } = useTranslation()
  const place = usePlaceDetail(stop.placeId)
  const arrival = parseApiDate(stop.arriveAt)
  if (!place.data?.name) return null
  return <View style={styles.warning}>
    {arrival ? <Text variant="caption" color="text.secondary">{arrival.toLocaleTimeString(i18n.language, { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</Text> : null}
    <Text variant="bodySmall" style={styles.warningText}>{place.data.name}</Text>
  </View>
}

/** Names, dates, photos and warnings come from the saved plan and its room. */
export function SavedPlanCard({ plan, conditionsChanged, onOpen, onGo, onRemove }: {
  plan?: Plan; conditionsChanged?: boolean; onOpen: () => void; onGo: () => void; onRemove: () => void
}) {
  const { t, i18n } = useTranslation()
  const stops = orderedSavedStops(plan)
  const first = usePlaceDetail(stops[0]?.placeId)
  const room = useRoom(plan?.roomId)
  const date = parseApiDate(room.data?.scheduledDate ?? stops[0]?.arriveAt)
  const title = [room.data?.title, date?.toLocaleDateString(i18n.language, { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })].filter(Boolean).join(' · ') || t('saved.plan.title')
  const photo = first.data ? detailToPlaceCard(first.data) : null
  const unavailable = plan?.hasUnavailableStops || stops.some(stop => !!stop.unavailableReason)
  return <Card padded={false} style={styles.card}>
    {photo?.photoUrl ? <View style={styles.photo}>
      <PlacePhoto uri={photo.photoUrl} placeId={photo.id} name={photo.name} style={styles.photoFill} />
      {photo.photoAttribution ? <Text variant="caption" color="text.secondary">{photo.photoAttribution}</Text> : null}
    </View> : null}
    <View style={styles.content}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !plan }} disabled={!plan} onPress={onOpen} style={styles.body}>
        <View style={styles.text}>
          <Text variant="title2">{title}</Text>
          {plan?.stops || !plan ? <Text variant="bodySmall" color="text.secondary">{plan ? t('saved.plan.stops', { count: stops.length }) : t('saved.plan.missing')}</Text> : null}
        </View>
      </Pressable>
      {conditionsChanged || plan?.isStale ? <Text variant="bodySmall" color="status.warningText">{t('saved.plan.stale')}</Text> : null}
      {unavailable ? <Text variant="bodySmall" color="status.warningText">{t('saved.plan.unavailable')}</Text> : null}
      {stops.map((stop, index) => <Stop key={stop.id ?? index} stop={stop} />)}
      {plan ? <View style={styles.actions}>
        <GhostBtn label={t('saved.plan.adjust')} onPress={onOpen} />
        <PrimaryBtn label={t('saved.plan.go')} onPress={onGo} />
      </View> : null}
      <GhostBtn label={t('saved.remove')} onPress={onRemove} />
    </View>
  </Card>
}
