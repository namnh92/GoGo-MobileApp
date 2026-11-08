import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { parseApiDate, useRoom, type Notification } from '@/shared/api'
import { isUuid } from '@/shared/navigation/deep-link'
import { Icon } from '@/shared/ui/icons'
import { Card, GhostBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text, type TextColor } from '@/shared/ui/text'
import { kindPresentation } from './notification-kind'
import { notificationAge } from './notification-time'
import { styles } from './notification-card.style'

function RoomLine({ roomId }: { roomId: string }) {
  const { t } = useTranslation()
  const name = useRoom(roomId).data?.title
  return name ? <Text variant="introSmall" color="redesign.secondary" style={styles.body}>{t('notifications.room', { name })}</Text> : null
}

export function NotificationCard({ item, index, busy, reading, onOpen, onLater }: {
  item: Notification; index: number; busy: boolean; reading: boolean
  onOpen: () => void; onLater: () => void
}) {
  const { t, i18n } = useTranslation()
  const unread = !item.readAt
  const created = parseApiDate(item.createdAt)
  const { icon, body } = kindPresentation(item.kind)
  const payload = item.payload
  const kindLabel = item.kind === 'campaign' && payload?.title
    ? payload.title : t(`notifications.kind.${item.kind}`, { defaultValue: item.kind ?? '' })
  const bodyText = item.kind === 'campaign' && payload?.body ? payload.body : body ? t(body) : null
  const roomId = index < 5 && !payload?.roomName && isUuid(payload?.roomId) ? payload.roomId : null
  const tone: TextColor = item.kind === 'invite' ? 'redesign.violetText' : item.kind === 'plan_ready'
    ? 'redesign.greenText' : item.kind === 'preference_reminder' || item.kind === 'date_reminder' ? 'accent.primary' : 'redesign.secondary'
  const progress = payload?.preferenceProgress
  const validProgress = progress && Number.isInteger(progress.completedCount) && Number.isInteger(progress.memberCount)
    && progress.memberCount > 0 && progress.completedCount >= 0 && progress.completedCount <= progress.memberCount
  const change = payload?.planChange
  const stopCount = payload?.stopCount
  const OpenButton = index === 0 ? PrimaryBtn : SecondaryBtn
  const age = created ? notificationAge(created) : null
  const relativeTime = age ? t(age.unit === 'now' ? 'g10.time.now' : age.unit === 'minute'
    ? 'g10.time.minute' : age.unit === 'hour' ? 'g10.time.hour' : 'g10.time.day', { count: age.count }) : null

  return <Card appearance="stitch" padded={false} style={[styles.row, unread && styles.rowUnread]}>
    <View style={[styles.iconTile, item.kind === 'invite' || item.kind === 'preference_reminder' ? styles.infoTile : item.kind === 'plan_ready' ? styles.successTile : undefined]}>
      <Icon name={icon} size={24} color={tone} />
      <View style={[styles.typeBadge, item.kind === 'plan_ready' ? styles.successBadge : item.kind === 'invite' ? styles.infoBadge : styles.accentBadge]}>
        <Icon name={item.kind === 'plan_ready' ? 'map' : icon} size={12} color="accent.onAccent" />
      </View>
    </View>
    <View style={styles.content}>
      <Pressable onPress={onOpen} disabled={busy} accessibilityRole="button"
        accessibilityLabel={[kindLabel, bodyText, created ? created.toLocaleString(i18n.language) : null, payload?.roomName, payload?.inviterName].filter(Boolean).join(', ')}
        accessibilityState={{ busy, disabled: busy }} style={styles.openTarget}>
        <View style={styles.cardHeading}>
          <Text variant="introLabel" color={tone} style={styles.kind}>{kindLabel}</Text>
          <View style={styles.timeRow}>
            {created ? <Text variant="introCaption" color="redesign.secondary">{relativeTime}</Text> : null}
            {unread ? <View testID={`notification-unread-${item.id}`} style={styles.unreadDot} /> : null}
          </View>
        </View>
        {bodyText ? <Text variant="introBody" color="redesign.ink" style={styles.body}>{bodyText}</Text> : null}
        {payload?.roomName ? <Text variant="introLabel" color="redesign.ink" style={styles.body}>{t('notifications.room', { name: payload.roomName })}</Text>
          : roomId ? <RoomLine roomId={roomId} /> : null}
        {item.kind === 'invite' && payload?.inviterName ? <Text variant="introSmall" color="redesign.secondary" style={styles.body}>{t('g10.inviter', { name: payload.inviterName })}</Text> : null}
        {item.kind === 'preference_reminder' && validProgress ? <View style={styles.progress}>
          <Icon name="checkCircle" size={14} color="redesign.greenText" />
          <Text variant="introCaption" color="redesign.ink">{t('g10.progress', { completed: progress.completedCount, total: progress.memberCount })}</Text>
        </View> : null}
        {item.kind === 'plan_ready' && typeof stopCount === 'number' && Number.isInteger(stopCount) && stopCount >= 0 ?
          <Text variant="introSmall" color="redesign.secondary" style={styles.body}>{t('g10.stopCount', { count: stopCount })}</Text> : null}
        {item.kind === 'plan_changed' && change ? <View style={styles.facts}>
          <Text variant="introCaption" color="redesign.secondary">{t(change.action === 'regenerate' ? 'g10.regenerated' : 'g10.edited')}</Text>
          {(['addedStopCount', 'removedStopCount', 'movedStopCount', 'durationChangedStopCount', 'lockChangedStopCount', 'optionalChangedStopCount'] as const).map(key =>
            Number.isInteger(change[key]) && change[key]! > 0 ? <Text key={key} variant="introCaption" color="redesign.secondary">{t(`g10.change.${key}`, { count: change[key] })}</Text> : null)}
        </View> : null}
        {busy ? <ActivityIndicator /> : null}
      </Pressable>
      {item.kind === 'invite' ? <View style={styles.actions}>
        <OpenButton size="small" variant="pill" label={t('g10.viewRoom')} loading={busy} onPress={onOpen} />
        <GhostBtn size="small" label={t('g10.later')} loading={reading} disabled={!item.id || !unread || reading}
          accessibilityHint={t('g10.laterHint')} onPress={onLater} />
      </View> : null}
    </View>
  </Card>
}
