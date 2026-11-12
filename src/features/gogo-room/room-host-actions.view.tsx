import { useCallback, useEffect, useRef, useState } from 'react'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Platform, View } from 'react-native'
import { roomCapabilities, type RoomSummary, useCreateRoomInvite, useRevokeRoomInvite, useRoomInvites, useTransitionRoom } from '@/shared/api'
import { sessionRoomInvite } from '@/shared/api/queries/use-rooms'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { releaseOnReturn, type RoutingHold } from '@/shared/navigation/routing-hold'
import { AppHeaderAction } from '@/shared/ui/app-header.view'
import { BlockingLoadingOverlay, useSubmitOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { Card, DangerBtn, GhostBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { activeRoomInvites, resolveInviteDisplay } from './invite-state'
import { shareRoomInvite } from './invite-share'
import { pendingRoomInvite } from './prepare-room-invite'
import { isoToLocalSchedule } from './room-schedule'
import { useInviteExpiry } from './use-invite-expiry'
import { styles } from './room-host-actions.style'

/** The lobby owns one invite/cancel transaction for both header and host group. */
export function useRoomHostActions(room: RoomSummary | undefined, roomId: string | undefined, hold: RoutingHold['hold']) {
  const { t } = useTranslation()
  const router = useRouter()
  const client = useQueryClient()
  const capabilities = roomCapabilities(room)
  const invites = useRoomInvites(capabilities.canInvite ? roomId : undefined)
  const create = useCreateRoomInvite(capabilities.canInvite ? roomId : undefined)
  const revoke = useRevokeRoomInvite(roomId ?? '')
  const cancel = useTransitionRoom(roomId ?? '')
  const hydrating = useSession().status === 'hydrating'
  const offline = useWaitingForNetwork(invites)
  const [clock, setClock] = useState(Date.now)
  const resolution = resolveInviteDisplay({ stored: hydrating ? undefined : create.stored, invites: invites.data,
    invitesFailed: invites.isError || (invites.isPaused && invites.data === undefined), listIsCurrent: !invites.isFetching && invites.dataUpdatedAt > (create.stored?.savedAt ?? 0), now: clock })
  const deadInvite = resolution.forget ? create.stored?.inviteId : undefined
  const forget = create.forget
  useEffect(() => { if (deadInvite) void forget(deadInvite) }, [deadInvite, forget])

  const active = activeRoomInvites(invites.data, clock)
  const current = active?.[active.length - 1]
  useInviteExpiry(active?.length ? Math.min(...active.map(row => Date.parse(row.expiresAt))) : undefined, setClock, clock)
  const [busy, setBusy] = useState(false)
  const submitOverlay = useSubmitOverlay(busy)
  const [outcome, setOutcome] = useState<{ code: string } | { confirm: true } | null>(null)
  const sharing = useRef(false)
  const lock = useRef(false)
  const [error, setError] = useState<'revoke' | 'create' | null>(null)
  const [copied, setCopied] = useState(false)
  const [replaceConfirm, setReplaceConfirm] = useState(false)
  const replacement = useRef(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const cancelLock = useRef(false)
  const [cancelFailed, setCancelFailed] = useState(false)
  const flowActive = replaceConfirm || cancelConfirm || busy || cancelBusy || outcome !== null
  useEffect(() => flowActive ? hold() : undefined, [flowActive, hold])
  const joinable = room?.status === 'draft' || room?.status === 'collecting'
  const baseUnavailable = !capabilities.canInvite || !joinable || hydrating || busy || outcome !== null
  const unavailable = baseUnavailable || invites.isPending || invites.isError || active === null
  const shareUnavailable = baseUnavailable || (resolution.display.kind !== 'code' && (invites.isPending || invites.isError || active === null))
  const title = room?.title?.trim() || t('gogoRoom.title', { context: room?.type })

  const roomType = room?.type
  const share = useCallback(async (code: string) => {
    const release = hold()
    try {
      if (roomType) track('gogo_invite_shared', { channel: 'native_share', roomType })
      if (await shareRoomInvite(code, title) === 'copied') setCopied(true)
    }
    catch { setError('create') }
    finally { if (Platform.OS === 'android') releaseOnReturn(release); else release() }
  }, [hold, roomType, title])
  async function makeInvite(replace: boolean) {
    if (!roomId || (replace ? unavailable : shareUnavailable) || lock.current) return
    lock.current = true
    setBusy(true); setError(null); setCopied(false)
    let phase: 'revoke' | 'create' = replace ? 'revoke' : 'create'
    try {
      // An unexpired device link remains shareable offline; never mint offline.
      if (!replace && !onlineManager.isOnline() && resolution.display.kind === 'code') {
        setOutcome({ code: resolution.display.code })
        return
      }
      // Creation may still be preparing the first link. Never race it.
      await pendingRoomInvite(client, roomId)?.catch(() => undefined)
      const fresh = await invites.refetch({ cancelRefetch: false })
      const usable = fresh.isError ? null : activeRoomInvites(fresh.data, Date.now())
      if (!usable) {
        if (!replace && resolution.display.kind === 'code') { setOutcome({ code: resolution.display.code }); return }
        throw new Error('Invite metadata unavailable')
      }
      if (replace) {
        for (const invite of usable) await revoke.mutateAsync(invite.inviteId)
      } else {
        const { display } = resolveInviteDisplay({ stored: sessionRoomInvite(client, roomId) ?? create.stored, invites: fresh.data,
          invitesFailed: false, listIsCurrent: true, now: Date.now() })
        if (display.kind === 'code') { setOutcome({ code: display.code }); return }
        if (usable.length) {
          // Metadata cannot recover another device's secret. Ask before replacing.
          setOutcome({ confirm: true })
          return
        }
      }
      phase = 'create'
      const invite = await create.mutateAsync({ maxUses: 20 })
      setOutcome({ code: invite.code })
    } catch { setError(phase) }
    finally {
      if (onlineManager.isOnline()) await invites.refetch()
      setBusy(false); lock.current = false
    }
  }
  function dismissCancel() { if (!cancelLock.current) { setCancelConfirm(false); setCancelFailed(false) } }
  function confirmCancel() {
    if (!capabilities.isHost || cancelLock.current) return
    cancelLock.current = true; setCancelBusy(true); setCancelFailed(false)
    cancel.mutate({ status: 'cancelled' }, {
      onSuccess: () => { setCancelConfirm(false); router.replace('/(tabs)/plans') },
      onError: () => setCancelFailed(true),
      onSettled: () => { cancelLock.current = false; setCancelBusy(false) },
    })
  }
  // When a fast read never mounted the overlay, it is already safe to present.
  // Otherwise useSubmitOverlay waits for the native dismissal callback.
  if (outcome && 'confirm' in outcome && !busy && submitOverlay.closed) {
    setOutcome(null)
    setReplaceConfirm(true)
  }
  useEffect(() => {
    if (!outcome || !('code' in outcome) || busy || !submitOverlay.closed || sharing.current) return
    sharing.current = true
    void share(outcome.code).finally(() => { sharing.current = false; setOutcome(null) })
  }, [outcome, busy, submitOverlay.closed, share])
  const [date, time] = isoToLocalSchedule(current?.expiresAt).split(' ')
  return {
    refresh: () => capabilities.canInvite ? invites.refetch() : Promise.resolve(),
    headerAction: capabilities.canInvite ? <AppHeaderAction testID="room-lobby-invite" accessibilityLabel={t('gogoRoom.invite')}
      accessibilityState={{ busy }} disabled={shareUnavailable} onPress={() => void makeInvite(false)}><Icon name="share" size={22} color="accent.primary" /></AppHeaderAction> : null,
    group: capabilities.isHost ? <Card testID="room-lobby-management" style={styles.card}>
      <Text variant="discoveryHeading" accessibilityRole="header">{t('roomLobby.management')}</Text>
      {invites.isPending ? offline ? <OfflineState /> : <Skeleton width="100%" height={44} /> : invites.isError || !active ? <ErrorState error={invites.error} onRetry={() => void invites.refetch()} /> : <View testID="room-lobby-invite-status">
        <Text variant="bodySmall">{t(current ? 'roomManage.currentInvite' : 'roomManage.noInvite')}</Text>
        {current ? <Text variant="caption" color="text.secondary">{[
          current.maxUses != null ? t(current.useCount != null ? 'roomManage.remainingUses' : 'roomManage.maximumUses', { n: current.maxUses - (current.useCount ?? 0) }) : null,
          t('roomManage.inviteExpiry', { date: `${time} ${date}` }),
        ].filter(Boolean).join(' · ')}</Text> : null}
      </View>}
      {!joinable ? <Text variant="caption" color="text.secondary">{t('roomManage.inviteUnavailable')}</Text> : null}
      {error ? <Text accessibilityLiveRegion="polite" color="status.dangerText">{t(error === 'revoke' ? 'gogoRoom.reissueFailed' : 'gogoRoom.inviteFailed')}</Text> : null}
      {copied ? <Text accessibilityLiveRegion="polite">{t('common.copied')}</Text> : null}
      <GhostBtn testID="room-lobby-change-invite" label={t('roomManage.changeInvite')} disabled={unavailable} onPress={() => setReplaceConfirm(true)} />
      <DangerBtn style={styles.dangerOutline} testID="room-lobby-cancel" label={t('roomManage.cancelRoom')} disabled={cancelBusy} onPress={() => { setCancelFailed(false); setCancelConfirm(true) }} />
    </Card> : null,
    dialogs: <>
      <BlockingLoadingOverlay visible={busy} onClosed={submitOverlay.onClosed} />
      <ResultSheet visible={replaceConfirm && capabilities.isHost} variant="warning" testID="room-lobby-invite-confirm"
        title={t('roomManage.changeInviteTitle')} body={t('roomManage.changeInviteBody')}
        onClose={() => setReplaceConfirm(false)}
        secondaryAction={{ label: t('common.cancel'), onPress: () => setReplaceConfirm(false) }}
        primaryAction={{ label: t('roomManage.changeInviteConfirm'), disabled: unavailable, onPress: () => { replacement.current = true; setReplaceConfirm(false) } }}
        onClosed={() => { if (replacement.current) { replacement.current = false; void makeInvite(true) } }} />
      <ResultSheet visible={cancelConfirm && capabilities.isHost} variant="warning" testID="room-lobby-cancel-confirm"
        title={t('roomManage.cancelTitle')} body={t('roomManage.cancelBody')} note={cancelFailed ? t('roomManage.saveFailed') : undefined}
        onClose={dismissCancel} secondaryAction={{ label: t('common.cancel'), disabled: cancelBusy, onPress: dismissCancel }}
        primaryAction={{ label: t('roomManage.cancelRoom'), destructive: true, loading: cancelBusy, disabled: cancelBusy, onPress: confirmCancel }} />
    </>,
  }
}
