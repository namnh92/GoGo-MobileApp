import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, useJoinRoom } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, AvatarCircle, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, glyph, spacing } from '@/shared/ui/tokens'

import { styles } from './guest-join.style'

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
  const insets = useSafeAreaInsets()
  const { status, joinAsGuest } = useSession()
  const joinRoom = useJoinRoom()
  const forget = useRecentRoomsStore(state => state.forget)
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>()

  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const asUser = status === 'user'
  const trimmedName = displayName.trim()

  function toMessage(caught: unknown): string {
    // GoGo-MobileApp#248 — two 410s ask for different next steps, so read the
    // code. A room past collecting takes nobody new: a fresh link would not
    // help, and saying "ask for a new link" sent people round in circles.
    if (isApiError(caught) && caught.code === 'ROOM_NOT_JOINABLE') return t('guestJoin.roomNotJoinableBody')
    // Expired, revoked or spent (`INVITE_NOT_USABLE`) — a new link does help.
    // Any other 410 keeps that reading, as before.
    if (isApiError(caught) && (caught.code === 'INVITE_NOT_USABLE' || caught.status === 410)) {
      return t('guestJoin.expiredBody')
    }
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
        track('gogo_partner_joined', { role: 'member' })
        if (!result?.roomId) {
          setError(t('guestJoin.failed'))
          return
        }
        // A room the actor was previously removed from would be stale here.
        forget(result.roomId)
        router.replace(`/room/${result.roomId}`)
        return
      }

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
      router.replace(`/room/${session.roomId}/preference`)
    } catch (caught) {
      setError(toMessage(caught))
    } finally {
      setPending(false)
    }
  }

  // A cold start can deliver the link before the stored session has been read.
  // Offering to join then would send a signed-in person down the guest path.
  if (status === 'hydrating') {
    return (
      <Atmosphere>
        <LoadingState />
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing[8],
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: spacing[6] }}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>📩 {t('guestJoin.badge')}</Text>
          </View>
          <Text style={styles.title}>{t('guestJoin.title')}</Text>
        </View>

        <View style={styles.pair}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="🎉" size={64} />
          </View>
          <Text style={{ fontSize: glyph.sm }}>+</Text>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="😊" size={64} />
            <Text style={[styles.pairName, { color: neutral[500] }]}>{t('guestJoin.you')}</Text>
          </View>
        </View>

        <GlassCard style={styles.details}>
          {asUser ? (
            <Text style={styles.detailLabel}>{t('guestJoin.asAccount')}</Text>
          ) : (
            <>
              <Text style={styles.detailsTitle}>{t('guestJoin.nameLabel')}</Text>
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
        </GlassCard>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
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
          {asUser ? null : <Text style={styles.noAccount}>{t('guestJoin.noAccount')}</Text>}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
