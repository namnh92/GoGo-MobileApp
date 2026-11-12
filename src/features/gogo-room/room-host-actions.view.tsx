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
import { useOnlineStatus, useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
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

/** A paused query has no network timeout. Bound the whole read/preparation phase. */
async function readBeforeDeadline<T>(read: () => Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Invite metadata unavailable')), Math.max(0, deadline - Date.now()))
      }),
    ])
  } finally { clearTimeout(timer) }
}

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
  const online = useOnlineStatus()
  const offline = useWaitingForNetwork(invites)
  const [clock, setClock] = useState(Date.now)
  const resolution = resolveInviteDisplay({ stored: hydrating ? undefined : create.stored, invites: invites.data,
    invitesFailed: invites.isError || (invites.isPaused && invites.data === undefined), listIsCurrent: !invites.isFetching && invites.dataUpdatedAt > (create.stored?.savedAt ?? 0), now: clock })
  const deadInvite = resolution.forget ? create.stored?.inviteId : undefined
  const forget = create.forget
  useEffect(() => { if (deadInvite) void forget(deadInvite) }, [deadInvite, forget])

  const active = activeRoomInvites(invites.data, clock)
  const current = active?.[active.length - 1]
  const displayedExpiry = resolution.display.kind === 'code' ? Date.parse(resolution.display.expiresAt) : undefined
  // Retain the status after forgetting an expired secret from storage.
  const [lastDisplayedExpiry, setLastDisplayedExpiry] = useState(displayedExpiry)
  if (displayedExpiry !== undefined && displayedExpiry !== lastDisplayedExpiry) setLastDisplayedExpiry(displayedExpiry)
  const expiries = [...(active ?? []).map(row => Date.parse(row.expiresAt)), Date.parse(create.stored?.expiresAt ?? '')]
    .filter(expiry => expiry > clock)
  useInviteExpiry(expiries.length ? Math.min(...expiries) : undefined, setClock, clock)
  const storedExpired = lastDisplayedExpiry !== undefined && lastDisplayedExpiry <= clock
  const [busy, setBusy] = useState(false)
  const submitOverlay = useSubmitOverlay(busy)
  const [outcome, setOutcome] = useState<{ code: string; expiresAt: string } | { confirm: true } | null>(null)
  const sharing = useRef(false)
  const lock = useRef(false)
  const [error, setError] = useState<'offline' | 'revoke' | 'create' | null>(null)
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
  const shareUnavailable = baseUnavailable || (online && resolution.display.kind !== 'code' && (invites.isPending || invites.isError || active === null))
  const title = room?.title?.trim() || t('gogoRoom.title', { context: room?.type })

  const roomType = room?.type
  const share = useCallback(async (code: string, expiresAt: string) => {
    // Native modal dismissal can take time; check again at the actual share boundary.
    if (!(Date.parse(expiresAt) > Date.now())) {
      setClock(Date.now()); setError(onlineManager.isOnline() ? 'create' : 'offline')
      return
    }
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
    const deviceCode = () => resolution.display.kind === 'code' && Date.parse(resolution.display.expiresAt) > Date.now()
      ? resolution.display : null
    setError(null); setCopied(false); setClock(Date.now())
    // Cached metadata does not make an online-only refetch safe to await offline.
    if (!onlineManager.isOnline()) {
      const stored = !replace ? deviceCode() : null
      if (stored) setOutcome({ code: stored.code, expiresAt: stored.expiresAt })
      else setError('offline')
      return
    }
    lock.current = true
    setBusy(true)
    let phase: 'revoke' | 'create' = replace ? 'revoke' : 'create'
    let changed = false
    const deadline = Date.now() + 15_000
    try {
      // Creation may still be preparing the first link. Never race it.
      const pending = pendingRoomInvite(client, roomId)
      if (pending) await readBeforeDeadline(() => pending.catch(() => undefined), deadline)
      const fresh = await readBeforeDeadline(() => invites.refetch({ cancelRefetch: false }), deadline)
        .catch(() => ({ data: undefined, isError: true }))
      const usable = fresh.isError ? null : activeRoomInvites(fresh.data, Date.now())
      if (!usable) {
        const stored = !replace ? deviceCode() : null
        if (stored) { setOutcome({ code: stored.code, expiresAt: stored.expiresAt }); return }
        throw new Error('Invite metadata unavailable')
      }
      if (!onlineManager.isOnline()) throw new Error('Offline')
      if (replace) {
        changed = true
        for (const invite of usable) await revoke.mutateAsync(invite.inviteId)
      } else {
        const { display } = resolveInviteDisplay({ stored: sessionRoomInvite(client, roomId) ?? create.stored, invites: fresh.data,
          invitesFailed: false, listIsCurrent: true, now: Date.now() })
        if (display.kind === 'code') { setOutcome({ code: display.code, expiresAt: display.expiresAt }); return }
        if (usable.length) {
          // Metadata cannot recover another device's secret. Ask before replacing.
          setOutcome({ confirm: true })
          return
        }
      }
      phase = 'create'
      changed = true
      const invite = await create.mutateAsync({ maxUses: 20 })
      setOutcome({ code: invite.code, expiresAt: invite.expiresAt })
    } catch { setError(onlineManager.isOnline() ? phase : 'offline') }
    finally {
      // Preserve post-mutation reconciliation, with a bound even if connectivity drops.
      if (changed && onlineManager.isOnline()) {
        await readBeforeDeadline(() => invites.refetch(), Date.now() + 15_000).catch(() => undefined)
      }
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
    void share(outcome.code, outcome.expiresAt).finally(() => { sharing.current = false; setOutcome(null) })
  }, [outcome, busy, submitOverlay.closed, share])
  const [date, time] = isoToLocalSchedule(current?.expiresAt).split(' ')
  return {
    refresh: () => capabilities.canInvite ? invites.refetch() : Promise.resolve(),
    headerAction: capabilities.canInvite ? <AppHeaderAction testID="room-lobby-invite" accessibilityLabel={t('gogoRoom.invite')}
      accessibilityState={{ busy }} disabled={shareUnavailable} onPress={() => void makeInvite(false)}><Icon name="share" size={22} color="accent.primary" /></AppHeaderAction> : null,
    group: capabilities.isHost ? <Card testID="room-lobby-management" style={styles.card}>
      <Text variant="discoveryHeading" accessibilityRole="header">{t('roomLobby.management')}</Text>
      {!current && storedExpired ? <Text accessibilityLiveRegion="polite">{t('guestJoin.expiredTitle')}</Text> : invites.isPending ? offline ? <OfflineState /> : <Skeleton width="100%" height={44} /> : invites.isError || !active ? <ErrorState error={invites.error} onRetry={() => void invites.refetch()} /> : <View testID="room-lobby-invite-status">
        <Text variant="bodySmall">{t(current ? 'roomManage.currentInvite' : 'roomManage.noInvite')}</Text>
        {current ? <Text variant="caption" color="text.secondary">{[
          current.maxUses != null ? t(current.useCount != null ? 'roomManage.remainingUses' : 'roomManage.maximumUses', { n: current.maxUses - (current.useCount ?? 0) }) : null,
          t('roomManage.inviteExpiry', { date: `${time} ${date}` }),
        ].filter(Boolean).join(' · ')}</Text> : null}
      </View>}
      {!joinable ? <Text variant="caption" color="text.secondary">{t('roomManage.inviteUnavailable')}</Text> : null}
      {error ? <Text accessibilityLiveRegion="polite" color="status.dangerText">{t(error === 'offline' ? 'common.offlineBody' : error === 'revoke' ? 'gogoRoom.reissueFailed' : 'gogoRoom.inviteFailed')}</Text> : null}
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
