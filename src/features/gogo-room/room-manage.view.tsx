import type { usePlaceDetail } from '@/shared/api'
import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  detailToPlaceCard,
  discoveryLabels,
  useSeedPlaceDetails,
  useTaxonomies,
  roomCapabilities,
  useRemoveRoomMember,
  useRemoveRoomSeedPlace,
  useRevokeRoomInvite,
  useRoom,
  useRoomInvites,
  useTransitionRoom,
} from '@/shared/api'
import { formatMoney } from '@/shared/pricing/money'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { useDialog } from '@/shared/ui/dialog.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, AvatarCircle, Card, DangerBtn, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { RoomMemberSkeleton, Skeleton } from '@/shared/ui/skeleton.view'
import { spacing } from '@/shared/ui/tokens'

import { RoomEditor } from './room-editor.view'
import { RoomEditSheet } from './room-edit-sheet.view'
import { roomScheduleRangeLabel } from './room-schedule'
import { RoomFacts } from './room-facts.view'
import { administrativeAreaLabel } from '@/shared/administrative/snapshot'
import { clearPickerScope, draftPickerScope, savePickerScope } from '@/shared/location/picker-scope'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { PlaceCardSmall } from '@/shared/ui/place-card-small.view'
import { styles } from './room-manage.style'

/** One cached detail query per seed; unknown/loading/error facts stay omitted. */
function SeedPlaceCard({ placeId, name, detail, onRemove }: {
  placeId: string; name: string
  detail: ReturnType<typeof usePlaceDetail>
  onRemove: () => void
}) {
  const { t, i18n } = useTranslation()
  const taxonomy = useTaxonomies({ kinds: 'category,mood,setting,amenity,suitability' })
  const fallback = { id: placeId, name }
  const place = detailToPlaceCard(
    detail.isError ? fallback : detail.data ?? fallback,
    discoveryLabels(taxonomy.data, i18n.language),
  )
  return <PlaceCardSmall place={place} onRemove={onRemove} removeAccessibilityLabel={t('roomManage.removeConfirm')}
    loading={detail.isFetching || detail.isPending}
    caption={detail.isError && !detail.isFetching ? <GhostBtn size="small" label={t('common.retry')} onPress={() => void detail.refetch()} /> : undefined} />
}

export default function RoomManageScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const seedDetails = useSeedPlaceDetails(room.data?.seedPlaces ?? [])
  const waitingForNetwork = useWaitingForNetwork(room)
  const invites = useRoomInvites(roomId)
  const revokeInvite = useRevokeRoomInvite(roomId)
  const removeMember = useRemoveRoomMember(roomId)
  const transitionRoom = useTransitionRoom(roomId)
  const removeSeedPlace = useRemoveRoomSeedPlace(roomId)

  const [editorPending, setEditorPending] = useState(false)
  const [areaChoosing, setAreaChoosing] = useState(false)
  const { confirm, dialog } = useDialog()
  const pickerScopeId = useRef<string | null>(null)
  const pickerOpening = useRef(false)
  const [isPickerOpening, setIsPickerOpening] = useState(false)
  useFocusEffect(useCallback(() => {
    pickerOpening.current = false
    setIsPickerOpening(false)
  }, []))
  useEffect(() => () => clearPickerScope(pickerScopeId.current), [])

  const summary = room.data
  const capabilities = roomCapabilities(summary)

  const header = (
    <View>
      <AppHeader onBack={() => router.back()} title={t('roomManage.title')} />
    </View>
  )

  if (room.isPending) {
    return (
      <Atmosphere>
        {header}
        {waitingForNetwork ? (
          <View style={styles.loading}><OfflineState /></View>
        ) : (
          <View testID="room-manage-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} style={styles.card}>
            <Skeleton width="60%" height={20} /><Skeleton width="100%" height={88} />
            <Skeleton width="45%" height={20} /><RoomMemberSkeleton />
          </View>
        )}
      </Atmosphere>
    )
  }

  if (room.isError || !summary) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={room.error} onRetry={() => void room.refetch()} />
      </Atmosphere>
    )
  }

  // Host-only, and the server enforces it — hiding the screen is not the guard.
  if (!capabilities.isHost) {
    return (
      <Atmosphere>
        {header}
        <EmptyState title={t('roomManage.hostOnlyTitle')} body={t('roomManage.hostOnlyBody')} />
      </Atmosphere>
    )
  }

  const constraints = summary.constraints
  const currency = constraints?.currency ?? 'VND'
  const storedArea = constraints?.administrativeArea
  const pickerScope = storedArea?.status === 'current'
    ? draftPickerScope({ administrativeArea: storedArea, originLat: null, originLng: null, radiusM: null }) : null

  async function confirmRemove(memberId: string, name: string) {
    const choice = await confirm({
      title: t('roomManage.removeTitle', { name }),
      message: t('roomManage.removeBody'),
      actions: [
        { key: 'cancel', label: t('account.deleteCancel'), style: 'cancel' },
        { key: 'remove', label: t('roomManage.removeConfirm'), style: 'destructive' },
      ],
    })
    if (choice === 'remove') removeMember.mutate(memberId)
  }

  async function confirmCancel() {
    // `cancelled` is terminal in the room state machine — there is no undo.
    const choice = await confirm({
      title: t('roomManage.cancelTitle'),
      message: t('roomManage.cancelBody'),
      actions: [
        { key: 'keep', label: t('account.deleteCancel'), style: 'cancel' },
        { key: 'cancel-room', label: t('roomManage.cancelRoom'), style: 'destructive' },
      ],
    })
    if (choice !== 'cancel-room') return
    transitionRoom.mutate({ status: 'cancelled' }, { onSuccess: () => router.replace('/(tabs)/plans') })
  }

  const members = summary.members ?? []

  return (
    <Atmosphere>
      <BlockingLoadingOverlay visible={transitionRoom.isPending || removeMember.isPending || removeSeedPlace.isPending || revokeInvite.isPending} />
      {header}
      <PullToRefresh onRefresh={async () => { await Promise.all([
        room.refetch(), invites.refetch(),
        seedDetails.refetchAll(),
      ]) }}>
      <ScrollView testID="room-manage-scroll"
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <RoomEditSheet pending={editorPending} title={t('roomEdit.title')}
          size={areaChoosing ? 'full' : 'content'} onClose={() => setAreaChoosing(false)}
          renderSummary={open => <>
            <View style={styles.sectionHead}>
              <Icon name="sliders" size={20} color="accent.primary" />
              <Text variant="discoveryHeading" style={styles.flex}>{t('gogoRoom.constraints')}</Text>
              <GhostBtn size="small" label={t('roomLobby.edit')} onPress={open} />
            </View>
            <Card padded={false} style={styles.card}>
              <RoomFacts facts={{
                name: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomTitle.title')}</Text><Text variant="body">{summary.title?.trim() || t('plans.untitled')}</Text></View></View>,
                area: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomLobby.area')}</Text><Text variant="body">{storedArea ? administrativeAreaLabel(storedArea) : ''}</Text></View></View>,
                budget: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomManage.budgetTitle')}</Text><Text variant="body">{constraints?.budgetAmount ? `${formatMoney(constraints.budgetAmount, currency)} ${budgetUnitLabel(constraints.budgetMode, summary.type, t)}` : ''}</Text></View></View>,
                schedule: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomSchedule.title')}</Text><Text variant="body">{roomScheduleRangeLabel(summary, i18n.language, t)}</Text></View></View>,
              }} />
            </Card>
          </>}>
          {(close, confirmConditions) => <RoomEditor room={summary} close={close} confirmConditions={confirmConditions}
            onPendingChange={setEditorPending} onChoosingChange={setAreaChoosing} />}
        </RoomEditSheet>

        <View style={styles.sectionHead}>
          <Icon name="mapPin" size={20} color="accent.primary" />
          <Text variant="discoveryHeading" style={styles.flex}>{t('roomManage.seedTitle')}</Text>
          <IconBtn accessibilityLabel={t('roomManage.addSeedPlaces')} style={styles.addSeed}
            disabled={!pickerScope || isPickerOpening} onPress={() => {
              if (!pickerScope || pickerOpening.current) return
              pickerOpening.current = true
              setIsPickerOpening(true)
              pickerScopeId.current = savePickerScope(pickerScope)
              router.push({ pathname: '/places/search', params: { picker: '1', roomId, pickerScope: pickerScopeId.current } })
            }}><Icon name="plus" size={20} color="accent.primary" /></IconBtn>
        </View>
        <Card padded={false} style={styles.card}>
          <Text variant="bodySmall" color="text.secondary">{t('createMood.seedHint')}</Text>
          {(summary.seedPlaces ?? []).map(seed => seed.placeId && seed.name ? (
            <SeedPlaceCard key={seed.placeId} placeId={seed.placeId} name={seed.name}
              detail={seedDetails.byPlaceId.get(seed.placeId)!}
              onRemove={() => seed.placeId && removeSeedPlace.mutate(seed.placeId)} />
          ) : null)}
          {!pickerScope ? <Text variant="bodySmall" color="text.secondary">{t('roomManage.seedScopeUnavailable')}</Text> : null}
        </Card>

        <View style={styles.sectionHead}>
          <Icon name="users" size={20} color="accent.primary" />
          <Text variant="discoveryHeading">{t('roomManage.membersTitle')}</Text>
        </View>
        <Card padded={false} style={styles.card}>
          {members.length === 0 ? <Text variant="bodySmall" color="text.secondary">{t('roomManage.noMembers')}</Text> : null}
          {members.map(member => (
            <View key={member.id} accessible={member.role === 'host'} accessibilityLabel={[member.displayName, t(`roomManage.role.${member.role}`), t(`roomManage.selection.${member.selectionStatus}`)].join(', ')} style={styles.row}>
              <AvatarCircle label={member.displayName.trim().charAt(0).toUpperCase() || '?'} size={44} imageUri={member.avatarUrl} host={member.role === 'host'} />
              <View style={styles.flex}>
                <Text variant="body" numberOfLines={1}>{member.displayName}</Text>
                <Text variant="caption" color="text.secondary" style={styles.rowMeta}>
                  {t(`roomManage.selection.${member.selectionStatus}`)}
                </Text>
              </View>
              {/* The host cannot remove themselves; the server rejects it too. */}
              {member.role !== 'host' ? (
                <Pressable
                  onPress={() => void confirmRemove(member.id, member.displayName)}
                  accessibilityRole="button"
                  accessibilityLabel={t('roomManage.removeConfirm')}
                  style={styles.rowAction}
                >
                  <Text variant="label" color="status.dangerText">{t('roomManage.removeConfirm')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </Card>

        <View style={styles.sectionHead}>
          <Icon name="unlock" size={20} color="accent.primary" />
          <Text variant="discoveryHeading">{t('roomManage.invitesTitle')}</Text>
        </View>
        <Card padded={false} style={styles.card}>
          {(invites.data as { inviteId?: string; expiresAt?: string; maxUses?: number }[] | undefined)?.map(
            invite => (
              <View key={invite.inviteId} style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="body">
                    {invite.maxUses != null
                      ? t('roomManage.inviteUses', { n: invite.maxUses })
                      : t('roomManage.invite')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => invite.inviteId && revokeInvite.mutate(invite.inviteId)}
                  accessibilityRole="button"
                  accessibilityLabel={t('roomManage.revoke')}
                  style={styles.rowAction}
                >
                  <Text variant="label" color="status.dangerText">{t('roomManage.revoke')}</Text>
                </Pressable>
              </View>
            ),
          )}
          {invites.isError ? (
            <Text variant="caption" color="status.warningText">{t('common.errorBody')}</Text>
          ) : null}
          {/* The endpoint returns metadata only — codes are shown once, at
              creation, and never listed again. */}
          <View style={styles.noteBox}>
            <Icon name="info" size={18} color="text.secondary" />
            <Text variant="bodySmall" color="text.secondary" style={styles.flex}>{t('roomManage.invitesBody')}</Text>
          </View>
        </Card>

        <Card padded={false} style={styles.dangerCard}>
          <View style={styles.noteRow}>
            <Icon name="alert" size={18} color="status.dangerText" />
            <Text variant="bodySmall" color="text.secondary" style={styles.flex}>{t('roomManage.cancelBody')}</Text>
          </View>
          <DangerBtn
            label={transitionRoom.isPending ? t('roomManage.cancelling') : t('roomManage.cancelRoom')}
            onPress={() => void confirmCancel()}
            disabled={transitionRoom.isPending}
          />
        </Card>


      </ScrollView>
      </PullToRefresh>
      {dialog}
    </Atmosphere>
  )
}
