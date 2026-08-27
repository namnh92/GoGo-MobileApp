import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isApiError,
  roomCapabilities,
  useRemoveRoomMember,
  useRemoveRoomSeedPlace,
  useRevokeRoomInvite,
  useRoom,
  useRoomInvites,
  useTransitionRoom,
  useUpdateRoomConstraints,
} from '@/shared/api'
import { formatMoney } from '@/shared/pricing/money'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'

import { BUDGET_TIERS } from '@/features/create-date/budget-tiers'
import { styles } from './room-manage.style'

export default function RoomManageScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId } = useLocalSearchParams<{ roomId: string }>()

  const room = useRoom(roomId)
  const invites = useRoomInvites(roomId)
  const updateConstraints = useUpdateRoomConstraints(roomId)
  const revokeInvite = useRevokeRoomInvite(roomId)
  const removeMember = useRemoveRoomMember(roomId)
  const transitionRoom = useTransitionRoom(roomId)
  const removeSeedPlace = useRemoveRoomSeedPlace(roomId)

  const [budgetAmount, setBudgetAmount] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const summary = room.data
  const capabilities = roomCapabilities(summary)

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('roomManage.title')} />
    </View>
  )

  if (room.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
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
  const selectedBudget = budgetAmount ?? constraints?.budgetAmount ?? 0
  const budgetDirty = selectedBudget !== (constraints?.budgetAmount ?? 0)

  async function saveConstraints() {
    if (!constraints || !summary) return
    setNotice(null)
    try {
      await updateConstraints.mutateAsync({
        ...constraints,
        budgetAmount: selectedBudget,
        currency,
        // Optimistic concurrency: a 409 means someone edited first.
        expectedConstraintVersion: summary.constraintVersion,
      })
      setBudgetAmount(null)
      // Changing a constraint marks scores and plans stale (RULE-CORE-006);
      // the hook already dropped them, so say what that means.
      setNotice(t('roomManage.savedStale'))
    } catch (caught) {
      setNotice(
        isApiError(caught) && caught.status === 409
          ? t('roomManage.conflict')
          : t('roomManage.saveFailed'),
      )
    }
  }

  function confirmRemove(memberId: string, name: string) {
    Alert.alert(t('roomManage.removeTitle', { name }), t('roomManage.removeBody'), [
      { text: t('account.deleteCancel'), style: 'cancel' },
      {
        text: t('roomManage.removeConfirm'),
        style: 'destructive',
        onPress: () => removeMember.mutate(memberId),
      },
    ])
  }

  function confirmCancel() {
    // `cancelled` is terminal in the room state machine — there is no undo.
    Alert.alert(t('roomManage.cancelTitle'), t('roomManage.cancelBody'), [
      { text: t('account.deleteCancel'), style: 'cancel' },
      {
        text: t('roomManage.cancelRoom'),
        style: 'destructive',
        onPress: () =>
          transitionRoom.mutate(
            { status: 'cancelled' },
            { onSuccess: () => router.replace('/(tabs)/plans') },
          ),
      },
    ])
  }

  const members = summary.members ?? []

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('roomManage.budgetTitle')}</Text>
          <Text style={styles.sectionBody}>
            {t(
              constraints?.budgetMode === 'per_person'
                ? 'groupSetup.perPerson'
                : 'groupSetup.groupTotal',
            )}
          </Text>
          <View style={styles.tierRow}>
            {BUDGET_TIERS.map(tier => {
              const active = selectedBudget === tier.amount
              return (
                <Pressable
                  key={tier.key}
                  onPress={() => setBudgetAmount(tier.amount)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.tier, active && styles.tierActive]}
                >
                  <Text style={[styles.tierLabel, active && styles.tierLabelActive]}>
                    {formatMoney(tier.amount, currency)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={styles.warning}>{t('roomManage.staleWarning')}</Text>
          <PrimaryBtn
            label={updateConstraints.isPending ? t('account.saving') : t('account.save')}
            onPress={saveConstraints}
            disabled={!budgetDirty}
            loading={updateConstraints.isPending}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('roomManage.membersTitle')}</Text>
          {members.length === 0 ? <Text style={styles.sectionBody}>{t('roomManage.noMembers')}</Text> : null}
          {members.map(member => (
            <View key={member.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{member.displayName}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    t(`roomManage.role.${member.role}`),
                    t(`roomManage.selection.${member.selectionStatus}`),
                  ].join(' · ')}
                </Text>
              </View>
              {/* The host cannot remove themselves; the server rejects it too. */}
              {member.role !== 'host' ? (
                <Pressable
                  onPress={() => confirmRemove(member.id, member.displayName)}
                  accessibilityRole="button"
                  accessibilityLabel={t('roomManage.removeConfirm')}
                  style={styles.rowAction}
                >
                  <Text style={styles.rowActionLabel}>{t('roomManage.removeConfirm')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('roomManage.invitesTitle')}</Text>
          {/* The endpoint returns metadata only — codes are shown once, at
              creation, and never listed again. */}
          <Text style={styles.sectionBody}>{t('roomManage.invitesBody')}</Text>
          {invites.isError ? (
            <Text style={styles.warning}>{t('common.errorBody')}</Text>
          ) : null}
          {(invites.data as { inviteId?: string; expiresAt?: string; maxUses?: number }[] | undefined)?.map(
            invite => (
              <View key={invite.inviteId} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {invite.maxUses != null
                      ? t('roomManage.inviteUses', { n: invite.maxUses })
                      : t('roomManage.invite')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => invite.inviteId && revokeInvite.mutate(invite.inviteId)}
                  accessibilityRole="button"
                  style={styles.rowAction}
                >
                  <Text style={styles.rowActionLabel}>{t('roomManage.revoke')}</Text>
                </Pressable>
              </View>
            ),
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('roomManage.seedTitle')}</Text>
          <Text style={styles.sectionBody}>{t('createMood.seedHint')}</Text>
          {(summary.seedPlaces ?? []).map(seed => (
            <View key={seed.placeId} style={styles.row}>
              <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>
                {seed.name}
              </Text>
              <Pressable
                onPress={() => seed.placeId && removeSeedPlace.mutate(seed.placeId)}
                accessibilityRole="button"
                accessibilityLabel={t('roomManage.removeConfirm')}
                style={styles.rowAction}
              >
                <Text style={styles.rowActionLabel}>{t('roomManage.removeConfirm')}</Text>
              </Pressable>
            </View>
          ))}
          <GhostBtn
            label={t('roomManage.addSeedPlaces')}
            onPress={() => router.push(`/places/search?picker=1&roomId=${roomId}`)}
          />
        </GlassCard>

        <Pressable
          onPress={confirmCancel}
          disabled={transitionRoom.isPending}
          accessibilityRole="button"
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelLabel}>
            {transitionRoom.isPending ? t('roomManage.cancelling') : t('roomManage.cancelRoom')}
          </Text>
        </Pressable>

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>
    </Atmosphere>
  )
}
