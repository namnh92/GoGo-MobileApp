import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { Chip } from '@/shared/ui/chip.view'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, isOffline, useJoinRoom, useInvitePreview } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { LoadingState } from '@/shared/ui/async-state.view'
import { InvitePreview, InvitePreviewSkeleton } from './invite-preview.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { InviteExpired } from './invite-expired.view'
import { JoinInput } from './join-input.view'
import { styles } from './guest-join.style'
import { GuestReplaceNotice, useConfirmReplaceGuest } from './guest-replace-notice.view'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

const MAX_DISPLAY_NAME = 50

/**
 * `/r/[inviteCode]` — where every invite lands: a universal link, a scheme link
 * rewritten by `+native-intent` (GoGo-MobileApp#203), and a resolved share link.
 *
 * A signed-in person joins as themselves. This screen used to call
 * `joinAsGuest` for everyone, which purges local session data and replaces the
 * account session with a room-scoped guest one — a user signed out of their
 * own account by opening an invite.
 */
export default function GuestJoinScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>()
  // A join in flight outlives a warm link (#596 F-05): a guest join persists its
  // session when it lands, which cancels any request started meanwhile under the
  // old session generation. So the lock lives here, above the per-code remount,
  // and invite B cannot submit until attempt A has settled.
  const [pending, setPending] = useState(false)
  // A warm link starts a separate attempt: errors, preview and dialog reset.
  return <GuestJoinInvite key={inviteCode} inviteCode={inviteCode} pending={pending} setPending={setPending} />
}

function GuestJoinInvite({ inviteCode, pending, setPending }: {
  inviteCode: string
  pending: boolean
  setPending: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const { confirmReplaceGuest, dialog } = useConfirmReplaceGuest()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { status, guestRoomId, joinAsGuest } = useSession()
  const joinRoom = useJoinRoom()
  const forget = useRecentRoomsStore(state => state.forget)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  const [displayName, setDisplayName] = useState('')
  const [expired, setExpired] = useState(false)
  const preview = useInvitePreview(inviteCode, status !== 'hydrating')
  const [blockedRoom, setBlockedRoom] = useState(false)
  const [unusable, setUnusable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const asUser = status === 'user'
  // #272: a guest session already on this device is replaced only on confirmation.
  const holdsGuestRoom = status === 'guest'
  const trimmedName = displayName.trim()

  /**
   * GoGo-MobileApp#203 — a join can finish after the person has left: the back
   * control, Android hardware back or a swipe all stay available while it is in
   * flight. Leaving pops or replaces this screen, so it is no longer focused, and
   * a late `replace` would pull them into the room from wherever they went.
   */
  function stillHere(): boolean {
    return navigation.isFocused()
  }

  function toMessage(caught: unknown): string {
    // GoGo-MobileApp#248 — two 410s ask for different next steps, so read the
    // code. A room past collecting takes nobody new: a fresh link would not
    // help, and saying "ask for a new link" sent people round in circles.
    if (isApiError(caught) && caught.code === 'ROOM_NOT_JOINABLE') return t('guestJoin.roomNotJoinableBody')
    // A room past its expiry (`ROOM_EXPIRED`) is not coming back either.
    if (isApiError(caught) && caught.code === 'ROOM_EXPIRED') return t('guestJoin.roomExpiredBody')
    // Expired, revoked or spent (`INVITE_NOT_USABLE`) — a new link does help.
    // Any other 410 keeps that reading, as before.
    if (isApiError(caught) && caught.status === 410) return t('guestJoin.expiredBody')
    if (isApiError(caught) && caught.status === 404) return t('guestJoin.notFoundBody')
    if (isOffline(caught)) return t('common.offlineBody')
    if (isApiError(caught) && caught.status === 429) return t('auth.rateLimited')
    return t('guestJoin.failed')
  }

  async function join() {
    if (pending) return
    if (!inviteCode) {
      setError(t('guestJoin.notFoundBody'))
      return
    }
    if (!asUser && !trimmedName) {
      setError(t('guestJoin.nameRequired'))
      return
    }

    setPending(true)
    setError(null)
    try {
      if (asUser) {
        const result = await joinRoom.mutateAsync({ inviteCode })
        if (!active.current) return
        // GoGo-BE#607: count a join only when the server says this request created
        // the membership. A member or the host reopening the invite gets
        // `alreadyMember: true`; a server older than alpha.49 sends no flag, which is
        // unknown, not a new join.
        if (result?.alreadyMember === false) track('gogo_partner_joined', { role: 'member' })
        if (!result?.roomId) {
          setError(t('guestJoin.failed'))
          return
        }
        // A room the actor was previously removed from would be stale here.
        forget(result.roomId)
        if (stillHere()) router.replace(`/room/${result.roomId}`)
        return
      }

      if (holdsGuestRoom && !(await confirmReplaceGuest())) return
      if (!active.current) return
      // Issues a room-scoped guest session and persists it to the Keychain —
      // no account, and the token reaches no other room.
      const session = await joinAsGuest({ inviteCode, displayName: trimmedName })
      if (!active.current) return
      track('gogo_partner_joined', { role: 'guest' })
      // Routes carry the room id from here on; the invite code is a credential.
      // A grant without one would build `/room/undefined/...` and 400 on every read.
      if (!session.roomId) {
        setError(t('guestJoin.failed'))
        return
      }
      if (stillHere()) router.replace(`/room/${session.roomId}/preference`)
    } catch (caught) {
      if (!active.current) return
      setBlockedRoom(isApiError(caught) && ['ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'].includes(caught.code))
      setUnusable(isApiError(caught) && (caught.status === 404 || (caught.status === 410 && ['ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'].includes(caught.code))))
      setExpired(
        isApiError(caught) &&
          caught.status === 410 &&
          caught.code !== 'ROOM_NOT_JOINABLE' &&
          caught.code !== 'ROOM_EXPIRED',
      )
      setError(toMessage(caught))
    } finally {
      // Always release: the lock is shared with whichever invite is on screen now.
      setPending(false)
    }
  }

  /**
   * GoGo-MobileApp#203 — the way out. An invite is often the first screen of a
   * cold start, with nothing behind it: iOS offers no edge swipe there and
   * `router.back()` alone does nothing, so someone holding a dead invite was
   * stuck until they relaunched the app. With no previous route it goes to `/`,
   * the start screen, which still decides between onboarding and Home — going
   * straight to the tabs skipped onboarding on a fresh install.
   */
  const leave = () => goBackOrHome(router)

  const header = (
    <View>
      <AppHeader title={t('guestJoin.screenTitle')} onBack={leave} />
    </View>
  )

  // A cold start can deliver the link before the stored session has been read.
  // Offering to join then would send a signed-in person down the guest path.
  if (status === 'hydrating') {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  const previewFailure = preview.error
  const unavailable = isApiError(previewFailure) && [404, 410].includes(previewFailure.status)
  const previewExpired = isApiError(previewFailure) && previewFailure.status === 410 && !['ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'].includes(previewFailure.code)
  // A terminal preview is a dead link for every session (G5-01).
  if (expired || unusable || unavailable) {
    return (
      <Atmosphere>
        {header}
        <InviteExpired canRequestLink={!blockedRoom && !(isApiError(previewFailure) && ['ROOM_NOT_JOINABLE', 'ROOM_EXPIRED'].includes(previewFailure.code))} unusable={unusable || (unavailable && !previewExpired)} message={error ?? (previewFailure ? toMessage(previewFailure) : undefined)} />
        {/* A late preview must not strand an awaited guest confirmation. */}
        {dialog}
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      <BlockingLoadingOverlay visible={pending} />
      {header}
      <ScrollView
        contentContainerStyle={{
          ...styles.content,
          paddingBottom: insets.bottom + spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {preview.data?.roomType ? <Chip style={styles.badge} appearance="discovery" icon={preview.data?.roomType === 'group' ? 'users' : 'heart'} label={t('guestJoin.badge', { context: preview.data?.roomType, count: preview.data?.participantCount })} /> : null}
        <Text variant="display" accessibilityRole="header" style={styles.title}>{t('guestJoin.title', { context: preview.data?.roomType, count: preview.data?.participantCount })}</Text>

        {preview.isPending ? <InvitePreviewSkeleton /> : preview.data ? <InvitePreview data={preview.data} /> : null}
        {previewFailure ? <View testID="invite-preview-error" style={[styles.errorBox, styles.previewError]}><Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.errorText}>{toMessage(previewFailure)}</Text><SecondaryBtn label={t('common.retry')} onPress={() => { void preview.refetch() }} /></View> : null}

        {holdsGuestRoom ? <GuestReplaceNotice guestRoomId={guestRoomId} /> : null}

        <Card padded={false} style={styles.details}>
          {asUser ? (
            <Text variant="bodySmall" color="text.secondary">{t('guestJoin.asAccount')}</Text>
          ) : (
            <>
              <View style={styles.hostHeading}><Text variant="title2" style={styles.factText}>{t('guestJoin.nameLabel')}</Text><Text variant="caption" color="text.secondary">{t('invitePreview.required')}</Text></View>
              <JoinInput
                fieldTestID="invite-name-field"
                value={displayName}
                onChangeText={value => {
                  setDisplayName(value)
                  if (error) setError(null)
                }}
                placeholder={t('guestJoin.namePlaceholder')}
                maxLength={MAX_DISPLAY_NAME}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={join}
                editable={!pending}
                accessibilityLabel={t('guestJoin.nameLabel')}
              />
            </>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert" size={18} color="status.dangerText" />
              <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          <PrimaryBtn
            variant="pill"
            label={pending ? t('guestJoin.joining') : t('guestJoin.join')}
            onPress={join}
            icon="arrowRight"
            loading={pending}
            disabled={!asUser && !trimmedName}
          />
          {asUser ? null : (
            <View style={styles.noAccountRow}>
              <Icon name="lock" size={14} color="status.successText" />
              <Text variant="bodySmall" color="text.secondary">{t('guestJoin.noAccount')}</Text>
            </View>
          )}
        </Card>
      </ScrollView>
      {dialog}
    </Atmosphere>
  )
}
