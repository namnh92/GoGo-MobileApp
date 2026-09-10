import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  memberProgress,
  roomCapabilities,
  type MemberSelectionStatus,
  type RoomMember,
  useCreateRoomInvite,
  useRoom,
  useRoomRealtime,
  useStartMatching,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { env } from '@/shared/config/env'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { formatMoney } from '@/shared/pricing/money'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { ErrorState, StaleNotice } from '@/shared/ui/async-state.view'
import {
  Atmosphere,
  AvatarCircle,
  BackHeader,
  Chip,
  GhostBtn,
  GlassCard,
  IconBtn,
  PrimaryBtn,
  SecondaryBtn,
} from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { IconCheck, IconCopy, IconUserOutline } from '@/shared/ui/icons'
import { colors, glyph, spacing } from '@/shared/ui/tokens'

import { styles } from './gogo-room.style'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'

const { brand } = colors

const AVATAR_COLORS = [brand.coral, brand.lavender, brand.mint, brand.amber]
const VISIBLE_AVATARS = 3

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * The lobby's whole job is answering "are we waiting on anyone?" (spec §16).
 * `selectionStatus` already carries that; before this it only fed a counter,
 * so a host could see 2/4 without knowing which two.
 */
const STATUS_CHIP: Record<MemberSelectionStatus, { key: string; variant: 'default' | 'info' | 'positive' }> = {
  pending: { key: 'gogoRoom.status.waiting', variant: 'default' },
  in_progress: { key: 'gogoRoom.status.choosing', variant: 'info' },
  completed: { key: 'gogoRoom.status.completed', variant: 'positive' },
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
  useRoomRealtime(roomId, 'lobby', { enabled: useScreenFocused() })
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
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6] }}>
          <RoomMemberSkeleton count={3} />
        </View>
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away a cached plan; the error screen is
  // only for having nothing at all to show (APP-007).
  if (!summary) {
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
      <StaleNotice error={room.isError ? room.error : null} onRetry={() => void room.refetch()} />
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
                    imageUri={member.avatarUrl}
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
            <AvatarCircle label={initial(members[0]?.displayName ?? '')} size={64} imageUri={members[0]?.avatarUrl} />
            <Text style={{ fontSize: glyph.sm }}>+</Text>
            {members[1] ? (
              <AvatarCircle
                label={initial(members[1].displayName)}
                size={64}
                background={brand.lavender}
                imageUri={members[1].avatarUrl}
              />
            ) : (
              <View style={styles.emptySeat}>
                <IconUserOutline />
              </View>
            )}
          </View>
        )}

        <Text style={styles.title}>{t('gogoRoom.title', { context: roomType })}</Text>
        <Text style={styles.body}>{t('gogoRoom.body', { context: roomType })}</Text>

        {/* What the room is actually constrained by — facts, composed here. */}
        {summary.constraints ? (
          <GlassCard style={styles.constraintsCard}>
            <Text style={styles.constraintsTitle}>{t('gogoRoom.constraints')}</Text>
            <View style={styles.constraintsRow}>
              <Chip
                label={t('groupSetup.people', { n: participantCount })}
                icon="👥"
                variant="default"
              />
              {summary.constraints.budgetAmount ? (
                <Chip
                  label={`${formatMoney(summary.constraints.budgetAmount, summary.constraints.currency ?? 'VND')} ${budgetUnitLabel(
                    summary.constraints.budgetMode,
                    roomType,
                    t,
                  )}`}
                  icon="💰"
                  variant="default"
                />
              ) : null}
            </View>
          </GlassCard>
        ) : null}

        {/* Per-member status, not just a count (spec §16). */}
        {members.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {t('gogoRoom.membersTitle', { joined: progress.completed, total: progress.total })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` },
                ]}
              />
            </View>
            <View style={styles.memberList}>
              {members.map((member: RoomMember, index: number) => {
                const chip = STATUS_CHIP[member.selectionStatus]
                return (
                  <GlassCard key={member.id} style={styles.memberRow}>
                    <AvatarCircle
                      label={initial(member.displayName)}
                      size={40}
                      background={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                      imageUri={member.avatarUrl}
                    />
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>{member.displayName}</Text>
                      {member.role === 'host' ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeLabel}>{t('gogoRoom.hostBadge')}</Text>
                        </View>
                      ) : null}
                      {member.isGuest ? (
                        <View style={styles.guestBadge}>
                          <Text style={styles.guestBadgeLabel}>{t('gogoRoom.guestBadge')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Chip label={t(chip.key)} variant={chip.variant} />
                  </GlassCard>
                )
              })}
            </View>
          </>
        ) : null}

        {capabilities.canInvite ? (
          <GlassCard style={styles.codeCard}>
            <Text style={styles.codeCaption}>{t('gogoRoom.codeLabel')}</Text>
            <View style={styles.codeRow}>
              {/* `selectable` so the code can still be lifted by hand if the
                  clipboard write is refused. */}
              <Text style={styles.code} selectable numberOfLines={2}>
                {inviteCode ?? '·····'}
              </Text>
              {/* Icon-only: a label here gets squeezed by a long code, and this
                  is the only way to lift the code other than the invite link. */}
              <IconBtn
                onPress={copyCode}
                disabled={!inviteCode}
                accessibilityLabel={t(codeCopied ? 'common.copied' : 'common.copy')}
                style={[styles.copyBtn, codeCopied && styles.copyBtnDone]}
              >
                {codeCopied ? <IconCheck /> : <IconCopy />}
              </IconBtn>
            </View>
          </GlassCard>
        ) : null}

        {/*
          One dominant CTA per screen (spec §7). Which one it is depends on
          where the room actually is: while people are still picking, inviting
          them is the job; once everyone has finished, starting the match is.
          Host-only either way, and server-enforced.
        */}
        {capabilities.isHost && progress.completed >= 2 && progress.completed === progress.total ? (
          <>
            <PrimaryBtn
              label={startMatching.isPending ? t('gogoRoom.starting') : t('gogoRoom.startMatching')}
              onPress={beginMatching}
              loading={startMatching.isPending}
            />
            {capabilities.canInvite ? (
              <SecondaryBtn
                label={linkCopied ? t('gogoRoom.linkCopied') : t('gogoRoom.invite')}
                onPress={invite}
                disabled={!inviteUrl}
                style={{ marginTop: spacing[2] }}
              />
            ) : null}
          </>
        ) : capabilities.canInvite ? (
          <PrimaryBtn
            label={linkCopied ? t('gogoRoom.linkCopied') : t('gogoRoom.invite')}
            onPress={invite}
            disabled={!inviteUrl}
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
