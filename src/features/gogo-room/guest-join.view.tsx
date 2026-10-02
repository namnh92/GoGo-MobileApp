import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, useJoinRoom } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, AvatarCircle, BackHeader, Card, PrimaryBtn } from '@/shared/ui/primitives'
import { Glyph, Text } from '@/shared/ui/text'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './guest-join.style'
import { confirmReplaceGuest, GuestReplaceNotice } from './guest-replace-notice.view'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

const { neutral } = colors

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
  const { t } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { status, guestRoomId, joinAsGuest } = useSession()
  const joinRoom = useJoinRoom()
  const forget = useRecentRoomsStore(state => state.forget)
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>()

  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
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

      if (holdsGuestRoom && !(await confirmReplaceGuest(t))) return
      // Issues a room-scoped guest session and persists it to the Keychain —
      // no account, and the token reaches no other room.
      const session = await joinAsGuest({ inviteCode, displayName: trimmedName })
      track('gogo_partner_joined', { role: 'guest' })
      // Routes carry the room id from here on; the invite code is a credential.
      // A grant without one would build `/room/undefined/...` and 400 on every read.
      if (!session.roomId) {
        setError(t('guestJoin.failed'))
        return
      }
      if (stillHere()) router.replace(`/room/${session.roomId}/preference`)
    } catch (caught) {
      setError(toMessage(caught))
    } finally {
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
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={leave} />
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

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: spacing[4],
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: spacing[6] }}>
          <View style={styles.badge}>
            <Text variant="label" color="accent.onSoft">📩 {t('guestJoin.badge')}</Text>
          </View>
          <Text variant="title1" style={styles.title}>{t('guestJoin.title')}</Text>
        </View>

        <View style={styles.pair}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="🎉" size={64} />
          </View>
          <Glyph size="sm">+</Glyph>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="😊" size={64} />
            <Text variant="label" color="text.secondary">{t('guestJoin.you')}</Text>
          </View>
        </View>

        {holdsGuestRoom ? <GuestReplaceNotice guestRoomId={guestRoomId} /> : null}

        <Card padded={false} style={styles.details}>
          {asUser ? (
            <Text variant="bodySmall" color="text.secondary">{t('guestJoin.asAccount')}</Text>
          ) : (
            <>
              <Text variant="label" style={styles.detailsTitle}>{t('guestJoin.nameLabel')}</Text>
              <TextInput
                value={displayName}
                onChangeText={value => {
                  setDisplayName(value)
                  if (error) setError(null)
                }}
                placeholder={t('guestJoin.namePlaceholder')}
                placeholderTextColor={neutral[500]}
                maxLength={MAX_DISPLAY_NAME}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={join}
                editable={!pending}
                accessibilityLabel={t('guestJoin.nameLabel')}
                style={styles.nameInput}
              />
            </>
          )}
        </Card>

        {error ? (
          <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: 'auto', gap: spacing[3] }}>
          <PrimaryBtn
            label={pending ? t('guestJoin.joining') : t('guestJoin.join')}
            onPress={join}
            loading={pending}
            disabled={!asUser && !trimmedName}
          />
          {asUser ? null : <Text variant="bodySmall" color="text.secondary" style={styles.noAccount}>{t('guestJoin.noAccount')}</Text>}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
