import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, View } from 'react-native'
import { parseApiDate, usePlaceDetail, useRoomMembers, type Notification } from '@/shared/api'
import { env } from '@/shared/config/env'
import { isUuid } from '@/shared/navigation/deep-link'
import { AvatarCircle } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { inviterMediaUrl, notificationCountdown, notificationText } from './notification-facts'
import { styles } from './notification-facts.style'

type Payload = NonNullable<Notification['payload']>
type Stop = NonNullable<Payload['planPreview']>['stops'][number]

export function NotificationInviter({ payload }: { payload: Payload }) {
  const members = useRoomMembers(isUuid(payload.roomId) ? payload.roomId : undefined)
  const ref = payload.inviterAvatar
  const imageUri = !members.isError && ref?.sourceType === 'gogo' ? members.data?.map(member => inviterMediaUrl(member.avatarUrl, ref.mediaKey)).find(Boolean) : null
  const initials = payload.inviterName?.trim().split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()
  return <AvatarCircle size={48} label={initials} imageUri={imageUri} />
}

function PlanThumbnail({ stop, standalone = false }: { stop: Stop; standalone?: boolean }) {
  const detail = usePlaceDetail(isUuid(stop.placeId) ? stop.placeId : undefined)
  const [failed, setFailed] = useState<string | null>(null)
  const photo = !detail.isError ? detail.data?.photos?.find(photo => photo.id === stop.mediaId && (photo.source === 'manual' || photo.source === 'community')) : undefined
  // Resolve only a URL supplied for the exact currently available GoGo media.
  let url: string | null = null
  try { if (photo?.url) url = new URL(photo.url, env.apiUrl).href } catch { /* Unusable media is omitted. */ }
  if (!url || url === failed || !/^https?:\/\//.test(url)) return null
  const image = <Image testID="notification-plan-thumbnail" source={{ uri: url }}
    style={styles.thumbnail} contentFit="cover" onError={() => setFailed(url)} accessible={false} />
  return standalone ? <View style={styles.preview}>{image}</View> : image
}

function ReminderTime({ start, trigger }: { start: Date; trigger?: NonNullable<Payload['reminder']>['trigger'] }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = setInterval(update, 60000)
    const resume = AppState.addEventListener('change', state => { if (state === 'active') update() })
    return () => { clearInterval(timer); resume.remove() }
  }, [])
  const countdown = notificationCountdown(start, now)
  return <Text variant="introBody" color="accent.primary">{trigger === 'room_started' ? t('g10.appointmentStarted') : t(countdown.key, { count: countdown.count })}</Text>
}

export function NotificationFacts({ kind, payload }: { kind: Notification['kind']; payload: Payload }) {
  const { t, i18n } = useTranslation()
  const preview = payload.planPreview
  const stops = Array.isArray(preview?.stops) ? preview.stops.slice(0, 3).sort((a, b) => a.position - b.position) : []
  const names = stops.map(stop => {
    const name = notificationText(stop.name)
    return name ? `${stop.position + 1}. ${name}` : null
  }).filter(Boolean).join(' • ')
  const start = payload.reminder ? parseApiDate(payload.reminder.startsAt) : parseApiDate(preview?.startAt)
  const time = start?.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  const venue = kind === 'date_reminder' ? notificationText(stops[0]?.name) : null
  const address = kind === 'date_reminder' ? notificationText(stops[0]?.addressText) : null
  const thumbnail = stops.find(stop => isUuid(stop.mediaId) && isUuid(stop.placeId))
  const planKind = kind === 'plan_ready' || kind === 'plan_changed'
  const showPreview = planKind && (names || time)

  return <>
    {showPreview ? <View testID="notification-plan-preview" style={styles.preview}>
      {thumbnail ? <PlanThumbnail stop={thumbnail} /> : null}
      <View style={styles.text}>
        {names ? <Text variant="introCaption" color="redesign.ink" numberOfLines={2}>{names}</Text> : null}
        {time ? <Text variant="introCaption" color="redesign.secondary" accessibilityLabel={t('g10.startsAt', { time: start!.toLocaleString(i18n.language) })}>{t('g10.startsAt', { time })}</Text> : null}
      </View>
    </View> : null}
    {planKind && !showPreview && thumbnail ? <PlanThumbnail stop={thumbnail} standalone /> : null}
    {kind === 'date_reminder' && (start || payload.reminder?.trigger === 'room_started' || venue || address) ? <View testID="notification-appointment" style={styles.appointment}>
      {start ? <ReminderTime start={start} trigger={payload.reminder?.trigger} />
        : payload.reminder?.trigger === 'room_started' ? <Text variant="introBody" color="accent.primary">{t('g10.appointmentStarted')}</Text> : null}
      {time ? <Text variant="introCaption" color="redesign.secondary" accessibilityLabel={t('g10.startsAt', { time: start!.toLocaleString(i18n.language) })}>{t('g10.startsAt', { time })}</Text> : null}
      {venue ? <Text variant="introBody" color="redesign.ink">{venue}</Text> : null}
      {address ? <View style={styles.venue}><Icon name="mapPin" size={14} color="redesign.secondary" />
        <Text variant="introCaption" color="redesign.secondary" style={styles.venueText}>{address}</Text></View> : null}
    </View> : null}
  </>
}
