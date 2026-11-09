import { useTranslation } from 'react-i18next'
import { ActivityIndicator, View } from 'react-native'
import { parseApiDate, useRoom, type Notification } from '@/shared/api'
import { isUuid } from '@/shared/navigation/deep-link'
import { Icon } from '@/shared/ui/icons'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text, type TextColor } from '@/shared/ui/text'
import { NotificationRow } from './notification-row.view'
import { kindPresentation } from './notification-kind'
import { formatNotificationTime } from './notification-time'
import { NotificationFacts, NotificationInviter } from './notification-facts.view'
import { notificationText } from './notification-facts'
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
    ? payload.title : t(`notifications.kind.${item.kind}`, { defaultValue: t('notifications.kind.unknown') })
  const bodyText = item.kind === 'campaign' && payload?.body ? payload.body : body ? t(body) : null
  const roomId = index < 5 && !payload?.roomName && isUuid(payload?.roomId) ? payload.roomId : null
  const tone: TextColor = item.kind === 'invite' ? 'redesign.violetText' : item.kind === 'plan_ready'
    ? 'redesign.greenText' : item.kind === 'preference_reminder' || item.kind === 'date_reminder' ? 'accent.primary' : 'redesign.secondary'
  const progress = payload?.preferenceProgress
  const validProgress = progress && Number.isInteger(progress.completedCount) && Number.isInteger(progress.memberCount)
    && progress.memberCount > 0 && progress.completedCount >= 0 && progress.completedCount <= progress.memberCount
  const change = payload?.planChange
  const stopCount = payload?.planPreview?.stopCount ?? payload?.stopCount
  const hasStopCount = item.kind === 'plan_ready' && typeof stopCount === 'number' && Number.isInteger(stopCount) && stopCount >= 0
  const OpenButton = index === 0 ? PrimaryBtn : SecondaryBtn
  const canOpenRoom = isUuid(payload?.roomId) && (item.kind === 'invite' || item.kind === 'preference_reminder')
  const canOpenPlan = ['plan_ready', 'plan_changed', 'date_reminder'].includes(item.kind ?? '') && (isUuid(payload?.roomId) || isUuid(payload?.planId))
  const expiry = item.kind === 'privacy_export_ready' && typeof payload?.expiresAt === 'string' ? parseApiDate(payload.expiresAt) : null
  const relativeTime = created ? formatNotificationTime(created, t) : null
  const factStart = payload?.reminder ? parseApiDate(payload.reminder.startsAt) : parseApiDate(payload?.planPreview?.startAt)
  const stopFacts = (payload?.planPreview?.stops ?? []).flatMap(stop => [notificationText(stop.name), notificationText(stop.addressText)])

  return <NotificationRow id={item.id} title={kindLabel} titleColor={tone} relativeTime={relativeTime} unread={unread}
    iconStyle={item.kind === 'invite' || item.kind === 'preference_reminder' ? styles.infoTile : item.kind === 'plan_ready' ? styles.successTile : undefined}
    icon={<>
      {item.kind === 'invite' && payload?.inviterAvatar ? <NotificationInviter payload={payload} /> : item.kind === 'preference_reminder' ? <MaterialIcon name="dining" size={24} color="redesign.violetInk" />
        : item.kind === 'plan_ready' ? <MaterialIcon name="sparkle" size={24} color={tone} /> : <Icon name={icon} size={24} color={tone} />}
      <View testID={`notification-type-badge-${item.id}`} style={[styles.typeBadge, item.kind === 'plan_ready' ? styles.successBadge : item.kind === 'invite' ? styles.infoBadge : item.kind === 'plan_changed' ? styles.neutralBadge : styles.accentBadge]}>
        {item.kind === 'plan_changed' ? <MaterialIcon name="calendar" size={12} color="accent.onAccent" />
          : <Icon name={item.kind === 'plan_ready' ? 'map' : icon} size={12} color="accent.onAccent" />}
      </View>
    </>}
    openTarget={{ onPress: onOpen, disabled: busy, accessibilityRole: 'button',
      accessibilityLabel: [kindLabel, bodyText, created ? created.toLocaleString(i18n.language) : null, payload?.roomName, payload?.inviterName,
        factStart ? t('g10.startsAt', { time: factStart.toLocaleString(i18n.language) }) : null, ...stopFacts].filter(Boolean).join(', '),
      accessibilityHint: t(unread ? 'g10.unread' : 'g10.read'), accessibilityState: { busy, disabled: busy } }}
    actions={
      item.kind === 'invite' ? <View style={styles.actions}>
        {canOpenRoom ? <OpenButton size="small" variant="pill" trailingIcon="arrowRight" label={t('g10.viewRoom')} loading={busy} onPress={onOpen} /> : null}
        <SecondaryBtn size="small" variant="neutralPill" label={t('g10.later')} loading={reading} disabled={!item.id || !unread || reading}
          accessibilityHint={t('g10.laterHint')} onPress={onLater} />
      </View> : canOpenRoom || canOpenPlan ? <View style={styles.actions}>
        <SecondaryBtn size="small" variant="neutralPill" trailingIcon="arrowRight" label={t(canOpenRoom ? 'g10.viewRoom' : 'g10.viewPlan')} loading={busy} onPress={onOpen} />
      </View> : null
    }>
    {bodyText || payload?.roomName || hasStopCount ? <Text variant="introBody" color="redesign.ink" style={styles.body}>
      {bodyText ? <Text variant="introBody" color="redesign.ink">{bodyText}</Text> : null}
      {payload?.roomName ? <>{bodyText ? ' ' : null}<Text variant="buttonLabel" color={item.kind === 'invite' ? 'accent.primary' : 'redesign.ink'}>{t('notifications.room', { name: payload.roomName })}</Text></> : null}
      {hasStopCount ? <> <Text variant="introBody" color="redesign.ink">{t('g10.stopCount', { count: stopCount })}</Text></> : null}
    </Text> : null}
    {roomId ? <RoomLine roomId={roomId} /> : null}
    {item.kind === 'invite' && payload?.inviterName ? <Text variant="introSmall" color="redesign.secondary" style={styles.body}>{t('g10.inviter', { name: payload.inviterName })}</Text> : null}
    {item.kind === 'preference_reminder' && validProgress ? <View style={styles.progress}>
      <Icon name="checkCircle" size={14} color="redesign.greenText" />
      <Text variant="introCaption" color="redesign.ink">{t('g10.progress', { completed: progress.completedCount, total: progress.memberCount })}</Text>
    </View> : null}
    {item.kind === 'plan_changed' && change ? <View style={styles.facts}>
      <Text variant="introCaption" color="redesign.secondary">{t(change.action === 'regenerate' ? 'g10.regenerated' : 'g10.edited')}</Text>
      {(['addedStopCount', 'removedStopCount', 'movedStopCount', 'durationChangedStopCount', 'lockChangedStopCount', 'optionalChangedStopCount'] as const).map(key =>
        Number.isInteger(change[key]) && change[key]! > 0 ? <Text key={key} variant="introCaption" color="redesign.secondary">{t(`g10.change.${key}`, { count: change[key] })}</Text> : null)}
    </View> : null}
    {payload ? <NotificationFacts kind={item.kind} payload={payload} /> : null}
    {expiry ? <Text variant="introCaption" color="redesign.secondary" style={styles.body}>{t('g10.exportExpires', { date: expiry.toLocaleString(i18n.language) })}</Text> : null}
    {busy ? <ActivityIndicator /> : null}
  </NotificationRow>
}
