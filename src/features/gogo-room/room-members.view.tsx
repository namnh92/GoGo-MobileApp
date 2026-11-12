import type { RoutingHold } from '@/shared/navigation/routing-hold'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { memberProgress, roomCapabilities, type RoomMember, type RoomSummary, useRemoveRoomMember } from '@/shared/api'
import { AvatarCircle, Card, Chip, GhostBtn } from '@/shared/ui/primitives'
import { RoomSectionHeading, RoomSectionDescription } from './room-section.view'
import { styles as sectionStyles } from './room-section.style'
import { Text } from '@/shared/ui/text'
import { Sheet } from '@/shared/ui/sheet.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { styles } from './room-members.style'

function MemberRows({ list, inSheet, isHost, myMemberId, testID, onRemove }: {
  list: RoomMember[]; inSheet: boolean; isHost: boolean; myMemberId?: string | null; testID: string
  onRemove: (member: RoomMember, inSheet: boolean) => void
}) {
  const { t } = useTranslation()
  return list.map((member, index) => <View key={member.id}
    testID={`${testID}-${inSheet ? 'sheet-' : ''}member-${index}`}
    accessible={!isHost || member.role === 'host'}
    accessibilityLabel={[member.displayName, t(`roomManage.role.${member.role}`), t(`roomManage.selection.${member.selectionStatus}`)].join(', ')}
    style={[styles.row, !inSheet && styles.lobbyRow, index > 0 && styles.rowSeparator]}>
    <AvatarCircle label={member.displayName.trim().charAt(0).toUpperCase() || '?'} size={44} imageUri={member.avatarUrl} host={member.role === 'host'} />
    <View style={styles.flex}>
      <Text variant="body" numberOfLines={1}>{member.displayName}</Text>
      <Text variant="caption" color="text.secondary">{t(`roomManage.selection.${member.selectionStatus}`)}</Text>
      {member.isGuest ? <Chip label={t('gogoRoom.guestBadge')} variant="info" /> : null}
    </View>
    {isHost && member.role !== 'host' && member.id !== myMemberId ? <Pressable testID={`${testID}-${inSheet ? 'sheet-' : ''}remove-${member.id}`}
      accessibilityRole="button" accessibilityLabel={t('roomMembers.removeLabel', { name: member.displayName })}
      onPress={() => onRemove(member, inSheet)} style={styles.rowAction}>
      <Text variant="label" color="status.dangerText">{t('roomMembers.remove')}</Text>
    </Pressable> : null}
  </View>)
}

/** One roster, limit and remove transaction for lobby rows and the full sheet. */
export function RoomMembers({ room, onRefresh, hold, testID = 'room-lobby' }: {
  room: RoomSummary; onRefresh: () => Promise<unknown>; hold?: RoutingHold['hold']; testID?: string
}) {
  const { t } = useTranslation()
  const remove = useRemoveRoomMember(room.id)
  const isHost = roomCapabilities(room).isHost
  const members = room.members ?? []
  const progress = memberProgress(room)
  const [expanded, setExpanded] = useState(false)
  const pendingTarget = useRef<RoomMember | null>(null)
  const [closingForRemove, setClosingForRemove] = useState(false)
  const [target, setTarget] = useState<RoomMember | null>(null)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const flowActive = expanded || !!target || closingForRemove
  useEffect(() => flowActive ? hold?.() : undefined, [flowActive, hold])
  function request(member: RoomMember, fromSheet: boolean) {
    if (!isHost || member.role === 'host' || member.id === room.myMemberId || lock.current) return
    setFailed(false)
    if (fromSheet) { pendingTarget.current = member; setClosingForRemove(true); setExpanded(false) }
    else setTarget(member)
  }
  function dismiss() { if (!lock.current) setTarget(null) }
  function confirm() {
    if (!target || !isHost || lock.current || !members.some(m => m.id === target.id && m.id !== room.myMemberId && m.role !== 'host')) return
    lock.current = true
    setBusy(true)
    setFailed(false)
    remove.mutate(target.id, {
      onSuccess: () => { setTarget(null); void onRefresh() },
      onError: () => setFailed(true),
      onSettled: () => { lock.current = false; setBusy(false) },
    })
  }
  return <>
    <Card testID={`${testID}-members`} style={sectionStyles.card}>
      <RoomSectionHeading icon="users" title={t('roomManage.membersTitle')} />
      <View style={styles.rows}><RoomSectionDescription>{t('gogoRoom.membersTitle', { joined: progress.completed, total: progress.total })} · {t('groupSetup.people', { n: room.participantCount })}</RoomSectionDescription>
      {members.length ? <MemberRows list={members.slice(0, 5)} inSheet={false} isHost={isHost} myMemberId={room.myMemberId} testID={testID} onRemove={request} /> : <Text variant="bodySmall" color="text.secondary">{t('roomManage.noMembers')}</Text>}
      {room.type !== 'couple' && members.length > 5 ? <GhostBtn testID={`${testID}-members-all`} label={t('roomMembers.showAll', { n: members.length })} onPress={() => setExpanded(true)} /> : null}
      </View>
    </Card>
    <Sheet visible={expanded} onClose={() => { pendingTarget.current = null; setClosingForRemove(false); setExpanded(false) }}
      onClosed={() => { const next = pendingTarget.current; pendingTarget.current = null; setClosingForRemove(false); if (next) setTarget(next) }}
      testID={`${testID}-members-sheet`} size="full" swipeToClose
      header={<Text variant="title2" accessibilityRole="header">{t('roomManage.membersTitle')}</Text>}>
      <MemberRows list={members} inSheet isHost={isHost} myMemberId={room.myMemberId} testID={testID} onRemove={request} />
    </Sheet>
    <ResultSheet visible={!!target && isHost} variant="warning" testID={`${testID}-member-confirm`}
      title={t('roomManage.removeTitle', { name: target?.displayName ?? '' })} body={t('roomManage.removeBody')}
      note={failed ? t('roomManage.saveFailed') : undefined}
      secondaryAction={{ label: t('common.cancel'), onPress: dismiss, disabled: busy }}
      primaryAction={{ label: t('roomManage.removeConfirm'), destructive: true, loading: busy, disabled: busy, onPress: confirm }} onClose={dismiss} />
  </>
}
