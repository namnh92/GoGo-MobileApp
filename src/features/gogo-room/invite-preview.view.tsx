import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import type { OpResponse } from '@/shared/api'
import { toMajorUnits } from '@/shared/pricing/money'
import { Card } from '@/shared/ui/primitives'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Text, type TextColor } from '@/shared/ui/text'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { styles } from './guest-join.style'
import { roomScheduleLabel } from './room-schedule'

function Fact({ icon, label, value, color = 'accent.primary' }: { icon: IconName; label: string; value: string; color?: TextColor }) {
  return <View style={styles.fact}><View style={styles.factIcon}><Icon name={icon} size={20} color={color} /></View><View style={styles.factText}><Text variant="caption" color="text.secondary">{label}</Text><Text variant="body">{value}</Text></View></View>
}

export function InvitePreviewSkeleton() {
  return <View testID="invite-preview-loading" style={styles.preview}><Skeleton height={88} /><Skeleton height={180} /></View>
}

export function InvitePreview({ data }: { data: OpResponse<'previewRoomInvite'> }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'vi-VN'
  const schedule = roomScheduleLabel(data.startAt, locale, { compact: true, endAt: data.endAt })
  const budget = data.budget
  const amount = budget ? new Intl.NumberFormat(locale, { style: 'currency', currency: budget.currency }).format(toMajorUnits(budget.amount, budget.currency)) : ''
  return <View style={styles.preview}>
    <Card padded={false} style={styles.host}>
      {data.inviter.avatarUrl ? <Image testID="invite-avatar" source={{ uri: data.inviter.avatarUrl }} cachePolicy="memory-disk" style={styles.avatar} accessibilityIgnoresInvertColors /> : null}
      <View style={styles.factText}>
        <View style={styles.hostHeading}><Text variant="title2" style={styles.factText}>{data.inviter.displayName}</Text><Text variant="caption" color="text.secondary">{t('invitePreview.inviter')}</Text></View>
        <Text variant="bodySmall" color="text.secondary">{t('invitePreview.invitesYou')}</Text>
        {data.inviter.emailVerified ? <Text variant="caption" color="status.successText">{t('invitePreview.emailVerified')}</Text> : null}
      </View>
    </Card>
    <Card padded={false} style={styles.details}>
      <View style={styles.hostHeading}><Text variant="title2" style={styles.factText}>{t('guestJoin.detailsTitle', { context: data.roomType, count: data.participantCount })}</Text><Text variant="caption" color="text.secondary">{t('invitePreview.general')}</Text></View>
      <Fact color="status.infoText" icon="users" label={t('invitePreview.people')} value={t(`invitePreview.${data.roomType}`, { count: data.participantCount })} />
      {schedule ? <Fact icon="clock" label={t('invitePreview.time')} value={schedule} /> : null}
      {data.area ? <Fact color="status.infoText" icon="mapPin" label={t('invitePreview.area')} value={[data.area.name, data.area.city].filter(Boolean).join(', ')} /> : null}
      {budget ? <Fact color="status.successText" icon="dollar" label={t('invitePreview.budget')} value={t(`invitePreview.budget.${budget.mode}`, { amount })} /> : null}
    </Card>
  </View>
}
