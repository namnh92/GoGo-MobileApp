import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isApiError,
  roomCapabilities,
  toPlanSummary,
  useEditPlanStops,
  usePlan,
  usePlanStopPlaces,
  useRoom,
} from '@/shared/api'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './plan-edit.style'

/** The contract accepts 1..8 stops. */
const MIN_STOPS = 1
const MAX_STOPS = 8

interface DraftStop {
  placeId: string
  durationMinutes: number
  isLocked: boolean
}

export default function PlanEditScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()

  const plan = usePlan(planId)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])
  const room = useRoom(summary?.roomId)
  const editStops = useEditPlanStops(planId)

  const capabilities = roomCapabilities(room.data)
  /** Null until the host reorders or removes something. */
  const [edited, setEdited] = useState<DraftStop[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Derived, not synced in an effect: the server plan shows through until the
  // host actually changes something.
  const serverStops = useMemo<DraftStop[]>(
    () =>
      (summary?.stops ?? []).map(stop => ({
        placeId: stop.placeId,
        durationMinutes: stop.durationMinutes,
        isLocked: stop.isLocked,
      })),
    [summary],
  )
  const draft = edited ?? serverStops

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('planEdit.title')} />
    </View>
  )

  if (plan.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  if (plan.isError || !summary) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      </Atmosphere>
    )
  }

  // Host-only, and server-enforced.
  if (!capabilities.isHost) {
    return (
      <Atmosphere>
        {header}
        <EmptyState title={t('roomManage.hostOnlyTitle')} body={t('planEdit.hostOnlyBody')} />
      </Atmosphere>
    )
  }

  function move(index: number, delta: number) {
    setEdited(previous => {
      const current = previous ?? serverStops
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  function remove(index: number) {
    setEdited(previous => {
      const current = previous ?? serverStops
      return current.length > MIN_STOPS ? current.filter((_, i) => i !== index) : current
    })
  }

  const changed =
    draft.length !== summary.stops.length ||
    draft.some((stop, index) => stop.placeId !== summary.stops[index]?.placeId)

  async function save() {
    if (!summary) return
    setError(null)
    try {
      // The server recomputes times, travel and costs and returns a new
      // version; `expectedVersion` guards against a concurrent edit.
      // Editing supersedes this plan and returns a new one, so going "back"
      // would land on a plan the server no longer accepts edits for.
      const next = await editStops.mutateAsync({ expectedVersion: summary.version, stops: draft })
      if (next.id) router.replace(`/plans/${next.id}`)
      else router.back()
    } catch (caught) {
      setError(
        isApiError(caught) && caught.status === 409
          ? t('planEdit.conflict')
          : t('planEdit.saveFailed'),
      )
    }
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
      >
        <Text style={styles.body}>{t('planEdit.body', { max: MAX_STOPS })}</Text>

        {draft.map((stop, index) => (
          <GlassCard key={`${stop.placeId}-${index}`} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {places.byPlaceId.get(stop.placeId)?.name ?? ''}
              </Text>
              <Text style={styles.meta}>
                {t('datePlan.minutes', { n: stop.durationMinutes })}
                {stop.isLocked ? ` · ${t('planEdit.locked')}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => move(index, -1)}
              disabled={index === 0}
              accessibilityLabel={t('planEdit.moveUp')}
              style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
            >
              <Text style={styles.iconLabel}>↑</Text>
            </Pressable>
            <Pressable
              onPress={() => move(index, 1)}
              disabled={index === draft.length - 1}
              accessibilityLabel={t('planEdit.moveDown')}
              style={[styles.iconBtn, index === draft.length - 1 && styles.iconBtnDisabled]}
            >
              <Text style={styles.iconLabel}>↓</Text>
            </Pressable>
            <Pressable
              onPress={() => remove(index)}
              disabled={draft.length <= MIN_STOPS}
              accessibilityLabel={t('roomManage.removeConfirm')}
              style={[styles.iconBtn, draft.length <= MIN_STOPS && styles.iconBtnDisabled]}
            >
              <Text style={styles.removeLabel}>✕</Text>
            </Pressable>
          </GlassCard>
        ))}

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <PrimaryBtn
          label={editStops.isPending ? t('account.saving') : t('account.save')}
          onPress={save}
          disabled={!changed}
          loading={editStops.isPending}
          style={styles.saveBtn}
        />
      </ScrollView>
    </Atmosphere>
  )
}
