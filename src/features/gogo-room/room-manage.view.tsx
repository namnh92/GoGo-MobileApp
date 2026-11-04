import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
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
import { useDialog } from '@/shared/ui/dialog.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, AvatarCircle, BackHeader, Card, DangerBtn, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { BUDGET_TIERS } from '@/features/create-date/budget-tiers'
import { RoomScheduleEditor } from './room-schedule-editor.view'
import { RoomTitleEditor } from './room-title-editor.view'
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
  const { confirm, dialog } = useDialog()

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
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHead}>
          <Icon name="sliders" size={20} color="accent.primary" />
          <Text variant="title2">{t('gogoRoom.constraints')}</Text>
        </View>
        <RoomTitleEditor room={summary} />
        <RoomScheduleEditor room={summary} />
        <Card padded={false} style={styles.card}>
          <Text variant="label" color="text.secondary">{t('roomManage.budgetTitle')}</Text>
          <Text variant="bodySmall" color="text.secondary">
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
                  <Text variant="label" color={active ? 'text.inverse' : 'text.primary'}>
                    {formatMoney(tier.amount, currency)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.warnBox}>
            <Icon name="alert" size={18} color="status.warningText" />
            <Text variant="caption" color="status.warningText" style={styles.flex}>{t('roomManage.staleWarning')}</Text>
          </View>
          <PrimaryBtn
            label={updateConstraints.isPending ? t('account.saving') : t('account.save')}
            onPress={saveConstraints}
            disabled={!budgetDirty}
            loading={updateConstraints.isPending}
          />
        </Card>

        <View style={styles.sectionHead}>
          <Icon name="mapPin" size={20} color="accent.primary" />
          <Text variant="title2">{t('roomManage.seedTitle')}</Text>
        </View>
        <Card padded={false} style={styles.card}>
          <Text variant="bodySmall" color="text.secondary">{t('createMood.seedHint')}</Text>
          {(summary.seedPlaces ?? []).map(seed => (
            <View key={seed.placeId} style={styles.row}>
              <Text variant="body" style={styles.flex} numberOfLines={1}>
                {seed.name}
              </Text>
              <Pressable
                onPress={() => seed.placeId && removeSeedPlace.mutate(seed.placeId)}
                accessibilityRole="button"
                accessibilityLabel={t('roomManage.removeConfirm')}
                style={styles.rowAction}
              >
                <Icon name="trash" size={16} color="status.dangerText" />
                <Text variant="label" color="status.dangerText">{t('roomManage.removeConfirm')}</Text>
              </Pressable>
            </View>
          ))}
          <GhostBtn
            label={t('roomManage.addSeedPlaces')}
            onPress={() => router.push(`/places/search?picker=1&roomId=${roomId}`)}
          />
        </Card>

        <View style={styles.sectionHead}>
          <Icon name="users" size={20} color="accent.primary" />
          <Text variant="title2">{t('roomManage.membersTitle')}</Text>
        </View>
        <Card padded={false} style={styles.card}>
          {members.length === 0 ? <Text variant="bodySmall" color="text.secondary">{t('roomManage.noMembers')}</Text> : null}
          {members.map(member => (
            <View key={member.id} style={styles.row}>
              <AvatarCircle label={member.displayName.trim().charAt(0).toUpperCase() || '?'} size={44} imageUri={member.avatarUrl} />
              <View style={styles.flex}>
                <Text variant="body" numberOfLines={1}>{member.displayName}</Text>
                <Text variant="caption" color="text.secondary" style={styles.rowMeta}>
                  {[
                    t(`roomManage.role.${member.role}`),
                    t(`roomManage.selection.${member.selectionStatus}`),
                  ].join(' · ')}
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
          <Text variant="title2">{t('roomManage.invitesTitle')}</Text>
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

        {notice ? (
          <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>
      {dialog}
    </Atmosphere>
  )
}
