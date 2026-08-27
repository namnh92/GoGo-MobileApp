import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  memberProgress,
  roomCapabilities,
  useCreateRoomInvite,
  useRoom,
  useRoomRealtime,
  useStartMatching,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { env } from '@/shared/config/env'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, AvatarCircle, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { IconUserOutline } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './gogo-room.style'

const { brand } = colors

const AVATAR_COLORS = [brand.coral, brand.lavender, brand.mint, brand.amber]
const VISIBLE_AVATARS = 3

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export default function GoGoRoomScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const rememberRoom = useRecentRoomsStore(state => state.remember)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const room = useRoom(roomId)
  // Members join and finish picking while this screen is open; the realtime
  // layer owns how that freshness arrives.
  useRoomRealtime(roomId, 'lobby')
  const createInvite = useCreateRoomInvite(roomId)
  const startMatching = useStartMatching(roomId)

  const summary = room.data
  const capabilities = roomCapabilities(summary)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (summary) rememberRoom(summary)
  }, [summary, rememberRoom])

  // The invite code is returned exactly once, so it is created on entry and
  // held in screen state — refetching the room will never bring it back.
  const requestedInvite = useRef(false)
  useEffect(() => {
    if (!capabilities.canInvite || requestedInvite.current || inviteCode) return
    requestedInvite.current = true
    createInvite
      .mutateAsync({ maxUses: 20 })
      .then(invite => setInviteCode(invite.code))
      .catch(() => {
        // Sharing stays unavailable; the room itself still works.
        requestedInvite.current = false
      })
  }, [capabilities.canInvite, inviteCode, createInvite])

  if (room.isPending) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
        </View>
        <LoadingState />
      </Atmosphere>
    )
  }

  if (room.isError || !summary) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
        </View>
        <ErrorState error={room.error} onRetry={() => void room.refetch()} />
      </Atmosphere>
    )
  }

  const roomType = summary.type
  const participantCount = summary.participantCount
  const members = summary.members ?? []
  const progress = memberProgress(summary)
  const inviteUrl = inviteCode ? `${env.webBaseUrl}/r/${inviteCode}` : null

  function flash(setter: (value: boolean) => void) {
    setter(true)
    timers.current.push(setTimeout(() => setter(false), 2000))
  }

  function copyCode() {
    if (!inviteCode) return
    track('gogo_invite_copied', { channel: 'code' })
    void Clipboard.setStringAsync(inviteCode).catch(() => {})
    flash(setCodeCopied)
  }

  async function invite() {
    if (!inviteUrl) return
    track('gogo_invite_shared', { channel: 'native_share', roomType })
    try {
      // Single share CTA → native share sheet; no hard-coded social buttons.
      await Share.share({ message: `${t('gogoRoom.title', { context: roomType })} ${inviteUrl}`, url: inviteUrl })
    } catch {
      await Clipboard.setStringAsync(inviteUrl).catch(() => {})
      flash(setLinkCopied)
    }
  }

  async function beginMatching() {
    try {
      await startMatching.mutateAsync()
      router.push(`/room/${roomId}/matching`)
    } catch {
      // The mutation's error state renders below; the room stays usable.
    }
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[8] }}>
        {roomType === 'group' ? (
          <View style={{ alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[6] }}>
            <View style={styles.avatarRow}>
              {members.slice(0, VISIBLE_AVATARS).map((member, index) => (
                <View key={member.id} style={styles.avatarWrap}>
                  <AvatarCircle
                    label={initial(member.displayName)}
                    size={56}
                    background={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                  />
                </View>
              ))}
              {members.length > VISIBLE_AVATARS && (
                <View style={[styles.avatarWrap, styles.morePeople]}>
                  <Text style={styles.morePeopleLabel}>+{members.length - VISIBLE_AVATARS}</Text>
                </View>
              )}
            </View>
            <Text style={styles.joined}>
              {t('gogoRoom.joined', { joined: members.length, total: participantCount })}
            </Text>
          </View>
        ) : (
          <View style={styles.couplePair}>
            <AvatarCircle label={initial(members[0]?.displayName ?? '')} size={64} />
            <Text style={{ fontSize: 24 }}>+</Text>
            {members[1] ? (
              <AvatarCircle label={initial(members[1].displayName)} size={64} background={brand.lavender} />
            ) : (
              <View style={styles.emptySeat}>
                <IconUserOutline />
              </View>
            )}
          </View>
        )}

        <Text style={styles.title}>{t('gogoRoom.title', { context: roomType })}</Text>
        <Text style={styles.body}>{t('gogoRoom.body', { context: roomType })}</Text>

        {capabilities.canInvite ? (
          <GlassCard style={styles.codeCard}>
            <Text style={styles.codeCaption}>{t('gogoRoom.codeLabel')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.code}>{inviteCode ?? '·····'}</Text>
              <Pressable
                onPress={copyCode}
                disabled={!inviteCode}
                style={[styles.copyBtn, codeCopied && { backgroundColor: brand.mintSoft }]}
              >
                <Text style={[styles.copyLabel, codeCopied && { color: brand.mint }]}>
                  {codeCopied ? t('common.copied') : t('common.copy')}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        {capabilities.canInvite ? (
          <PrimaryBtn
            label={linkCopied ? t('gogoRoom.linkCopied') : t('gogoRoom.invite')}
            onPress={invite}
            disabled={!inviteUrl}
          />
        ) : null}

        {/* Host-only: everyone has picked, so the ranking can be built. */}
        {capabilities.isHost && progress.completed >= 2 && progress.completed === progress.total ? (
          <PrimaryBtn
            label={startMatching.isPending ? t('gogoRoom.starting') : t('gogoRoom.startMatching')}
            onPress={beginMatching}
            loading={startMatching.isPending}
            style={{ marginTop: spacing[3] }}
          />
        ) : null}

        {startMatching.isError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {t('gogoRoom.startFailed')}
          </Text>
        ) : null}

        <GhostBtn
          label={t('gogoRoom.myPreferences')}
          onPress={() => router.push(`/room/${roomId}/preference`)}
        />

        {capabilities.isHost ? (
          <GhostBtn label={t('roomManage.title')} onPress={() => router.push(`/room/${roomId}/manage`)} />
        ) : null}

        <View style={styles.noApp}>
          <View style={styles.noAppDot} />
          <Text style={styles.noAppLabel}>{t('gogoRoom.noApp', { context: roomType })}</Text>
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
