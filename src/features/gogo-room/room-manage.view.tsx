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
  useCreateRoomInvite,
  useRoom,
  useRoomInvites,
  useTransitionRoom,
} from '@/shared/api'
import { formatMoney } from '@/shared/pricing/money'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, AvatarCircle, Card, DangerBtn, GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { RoomMemberSkeleton, Skeleton } from '@/shared/ui/skeleton.view'
import { spacing } from '@/shared/ui/tokens'

import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { useInviteExpiry } from './use-invite-expiry'
import { activeRoomInvites } from './invite-state'
import { shareRoomInvite } from './invite-share'
import { isoToLocalSchedule, roomScheduleRangeLabel } from './room-schedule'
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
  const invitesWaitingForNetwork = useWaitingForNetwork(invites)
  const revokeInvite = useRevokeRoomInvite(roomId)
  const createInvite = useCreateRoomInvite(roomId)
  const [inviteConfirm, setInviteConfirm] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const inviteLock = useRef(false)
  const confirmedReplacement = useRef(false)
  const pendingShare = useRef<(() => Promise<void>) | null>(null)
  const [inviteError, setInviteError] = useState<'create' | 'revoke' | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [inviteClock, setInviteClock] = useState(() => Date.now())
  const activeInvites = activeRoomInvites(invites.data, inviteClock)
  const currentInvite = activeInvites?.[activeInvites.length - 1]
  useInviteExpiry(activeInvites?.length ? Math.min(...activeInvites.map(invite => Date.parse(invite.expiresAt))) : undefined, setInviteClock, inviteClock)
  const removeMember = useRemoveRoomMember(roomId)
  const transitionRoom = useTransitionRoom(roomId)
  const removeSeedPlace = useRemoveRoomSeedPlace(roomId)

  const [confirmAction, setConfirmAction] = useState<{ kind: 'cancel' } | { kind: 'remove'; memberId: string; name: string } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState(false)
  const confirmLock = useRef(false)
  const pickerScopeId = useRef<string | null>(null)
  const pickerOpening = useRef(false)
  const [isPickerOpening, setIsPickerOpening] = useState(false)
  useFocusEffect(useCallback(() => {
    pickerOpening.current = false
    setIsPickerOpening(false)
  }, [setIsPickerOpening]))
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

  // A failed background/recovery refetch must not unmount an open editor draft.
  if (!summary) {
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

  function confirmRemove(memberId: string, name: string) {
    if (confirmLock.current) return
    setConfirmError(false)
    setConfirmAction({ kind: 'remove', memberId, name })
  }
  function confirmCancel() {
    if (confirmLock.current) return
    setConfirmError(false)
    setConfirmAction({ kind: 'cancel' })
  }
  function dismissConfirmation() { if (!confirmLock.current) setConfirmAction(null) }
  function performConfirmation() {
    if (!confirmAction || confirmLock.current) return
    confirmLock.current = true
    setConfirmBusy(true)
    setConfirmError(false)
    const onSettled = () => { confirmLock.current = false; setConfirmBusy(false) }
    const onError = () => setConfirmError(true)
    if (confirmAction.kind === 'remove') removeMember.mutate(confirmAction.memberId, {
      onSuccess: () => setConfirmAction(null), onError, onSettled,
    })
    else transitionRoom.mutate({ status: 'cancelled' }, {
      onSuccess: () => { setConfirmAction(null); router.replace('/(tabs)/plans') }, onError, onSettled,
    })
  }

  const members = summary.members ?? []
  const inviteJoinable = summary.status === 'draft' || summary.status === 'collecting'
  const [expiryDate, expiryTime] = isoToLocalSchedule(currentInvite?.expiresAt).split(' ')
  const inviteUnavailable = invites.isPending || invites.isError || !activeInvites || inviteBusy || !inviteJoinable

  async function makeInvite(replace: boolean) {
    if (inviteLock.current || inviteUnavailable) return
    inviteLock.current = true
    setInviteConfirm(false)
    setInviteBusy(true)
    setInviteError(null)
    setLinkCopied(false)
    let phase: 'revoke' | 'create' = replace ? 'revoke' : 'create'
    try {
      // Refresh before revoking: include links another device created meanwhile.
      const fresh = await invites.refetch({ cancelRefetch: false })
      const active = fresh.isError ? null : activeRoomInvites(fresh.data, Date.now())
      if (!active) throw new Error('Invite metadata unavailable')
      if (!replace && active.length) return
      if (replace) {
        for (const invite of active) await revokeInvite.mutateAsync(invite.inviteId)
      }
      phase = 'create'
      const invite = await createInvite.mutateAsync({ maxUses: 20 })
      await invites.refetch()
      // iOS can present the native chooser only after the submit modal leaves.
      pendingShare.current = async () => {
        try {
          if (await shareRoomInvite(invite.code, t('gogoRoom.title', { context: summary?.type })) === 'copied') setLinkCopied(true)
        } catch { setInviteError('create') }
      }
    } catch {
      setInviteError(phase)
      // Revocation updates the query cache too, so a failed refresh cannot
      // resurrect a link that was revoked before creation failed.
      await invites.refetch()
    } finally {
      setInviteBusy(false)
      inviteLock.current = false
    }
  }

  return (
    <Atmosphere>
      <BlockingLoadingOverlay visible={removeSeedPlace.isPending || revokeInvite.isPending || inviteBusy} onClosed={() => {
        const share = pendingShare.current
        pendingShare.current = null
        if (share) void share()
      }} />
      {header}
      <PullToRefresh onRefresh={async () => { await Promise.all([
        room.refetch(), invites.refetch(),
        seedDetails.refetchAll(),
      ]) }}>
      <ScrollView testID="room-manage-scroll"
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
            <View style={styles.sectionHead}>
              <Icon name="sliders" size={20} color="accent.primary" />
              <Text variant="discoveryHeading" style={styles.flex}>{t('gogoRoom.constraints')}</Text>
              <GhostBtn size="small" label={t('roomLobby.edit')} onPress={() => router.push(`/room/${roomId}/edit`)} />
            </View>
            <Card padded={false} style={styles.card}>
              <RoomFacts facts={{
                name: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomTitle.title')}</Text><Text variant="body">{summary.title?.trim() || t('plans.untitled')}</Text></View></View>,
                area: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomLobby.area')}</Text><Text variant="body">{storedArea ? administrativeAreaLabel(storedArea) : ''}</Text></View></View>,
                budget: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomManage.budgetTitle')}</Text><Text variant="body">{constraints?.budgetAmount ? `${formatMoney(constraints.budgetAmount, currency)} ${budgetUnitLabel(constraints.budgetMode, summary.type, t)}` : ''}</Text></View></View>,
                schedule: <View style={styles.conditionRow}><View style={styles.flex}><Text variant="caption" color="text.secondary">{t('roomSchedule.title')}</Text><Text variant="body">{roomScheduleRangeLabel(summary, i18n.language, t)}</Text></View></View>,
              }} />
            </Card>


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
          <Text variant="bodySmall" color="text.secondary">{t('createPlaces.body')}</Text>
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
          {members.map((member, index) => (
            <View testID={`room-manage-member-${index}`} key={member.id} accessible={member.role === 'host'} accessibilityLabel={[member.displayName, t(`roomManage.role.${member.role}`), t(`roomManage.selection.${member.selectionStatus}`)].join(', ')} style={[styles.row, index > 0 && styles.rowSeparator]}>
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
          {invites.isPending ? (invitesWaitingForNetwork ? <OfflineState /> : <Skeleton width="100%" height={64} />) : invites.isError || !activeInvites ? (
            <ErrorState error={invites.error} onRetry={() => void invites.refetch()} />
          ) : (
            <View testID="room-manage-invite-row" style={styles.row}>
              <View style={styles.flex}>
                <Text variant="body">{t(currentInvite ? 'roomManage.currentInvite' : 'roomManage.noInvite')}</Text>
                {currentInvite ? <Text variant="caption" color="text.secondary">
                  {[
                    currentInvite.maxUses != null ? t(currentInvite.useCount != null ? 'roomManage.remainingUses' : 'roomManage.maximumUses', {
                      n: currentInvite.maxUses - (currentInvite.useCount ?? 0),
                    }) : null,
                    t('roomManage.inviteExpiry', { date: `${expiryTime} ${expiryDate}` }),
                  ].filter(Boolean).join(' · ')}
                </Text> : null}
              </View>
              <GhostBtn size="small" label={t(currentInvite ? 'roomManage.changeInvite' : 'roomManage.createInvite')}
                disabled={inviteUnavailable} onPress={() => currentInvite ? setInviteConfirm(true) : void makeInvite(false)} />
            </View>
          )}
          {!inviteJoinable ? <Text variant="caption" color="text.secondary">{t('roomManage.inviteUnavailable')}</Text> : null}
          {inviteError ? <Text variant="caption" color="status.dangerText" accessibilityLiveRegion="polite">{t(inviteError === 'revoke' ? 'gogoRoom.reissueFailed' : 'gogoRoom.inviteFailed')}</Text> : null}
          {linkCopied ? <Text variant="caption" accessibilityLiveRegion="polite">{t('common.copied')}</Text> : null}
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
      <ResultSheet visible={inviteConfirm} variant="warning" testID="room-manage-invite-confirm"
        title={t('roomManage.changeInviteTitle')} body={t('roomManage.changeInviteBody')}
        secondaryAction={{ label: t('account.deleteCancel'), onPress: () => setInviteConfirm(false) }}
        primaryAction={{ label: t('roomManage.changeInviteConfirm'), onPress: () => { confirmedReplacement.current = true; setInviteConfirm(false) }, disabled: inviteUnavailable }}
        onClose={() => setInviteConfirm(false)} onClosed={() => {
          if (!confirmedReplacement.current) return
          confirmedReplacement.current = false
          void makeInvite(true)
        }} />
      <ResultSheet visible={!!confirmAction} variant="warning" testID="room-manage-confirm"
        title={t(confirmAction?.kind === 'remove' ? 'roomManage.removeTitle' : 'roomManage.cancelTitle', { name: confirmAction?.kind === 'remove' ? confirmAction.name : '' })}
        body={t(confirmAction?.kind === 'remove' ? 'roomManage.removeBody' : 'roomManage.cancelBody')}
        note={confirmError ? t('roomManage.saveFailed') : undefined}
        secondaryAction={{ label: t('common.cancel'), onPress: dismissConfirmation, disabled: confirmBusy }}
        primaryAction={{ label: t(confirmAction?.kind === 'remove' ? 'roomManage.removeConfirm' : 'roomManage.cancelRoom'),
          destructive: true, loading: confirmBusy, disabled: confirmBusy, onPress: performConfirmation }}
        onClose={dismissConfirmation} />
    </Atmosphere>
  )
}
