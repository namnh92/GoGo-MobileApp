import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isOffline, toPlanSummary, usePlan, usePlanStopPlaces } from '@/shared/api'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Atmosphere, BackHeader, Card, Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { PlanSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'

import { styles } from './plan-change.style'

const OPTIONS: { key: 'keep' | 'category' | 'closer'; icon: IconName }[] = [
  { key: 'keep', icon: 'lock' },
  { key: 'category', icon: 'compass' },
  { key: 'closer', icon: 'navigation' },
]

/**
 * Đổi phương án (#452, owner 2026-11-05: build the screen, leave a TODO).
 *
 * TODO(#452): `POST /plans/{id}/regenerate` takes none of these choices, so they
 * and the main action are shown unavailable, with the reason, until an endpoint
 * exists (core rule 16). Do not wire the button to the plain regenerate: it would
 * ignore what the person picked here. The draft's category names are sample data
 * and need taxonomy from the API.
 */
export default function PlanChangeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()
  const leave = () => goBackOrHome(router)

  const plan = usePlan(planId)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader title={t('planChange.title')} onBack={leave} />
    </View>
  )

  if (plan.isPending) {
    return (
      <Atmosphere>
        {header}
        <PlanSkeleton />
      </Atmosphere>
    )
  }
  if (!summary) {
    return (
      <Atmosphere>
        {header}
        {isOffline(plan.error) ? <OfflineState /> : <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />}
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 240 }]}>
        <View style={styles.intro}>
          <Text variant="display" accessibilityRole="header">{t('planChange.question')}</Text>
          <Text color="text.secondary">{t('planChange.hint')}</Text>
        </View>

        <Text variant="title2" accessibilityRole="header" style={styles.sectionTitle}>{t('planChange.current')}</Text>
        {summary.stops.map((stop, index) => (
          <Card key={stop.id} padded={false} style={styles.stop}>
            <View style={styles.stopText}>
              <Text variant="label" numberOfLines={2}>{places.byPlaceId.get(stop.placeId)?.name ?? ''}</Text>
              <Text variant="bodySmall" color="text.secondary">
                {stop.arriveLabel ?? t('datePlan.stopOrder', { n: index + 1 })}
              </Text>
            </View>
            {stop.isLocked ? <Chip label={t('datePlan.locked')} icon="lock" variant="warning" /> : null}
          </Card>
        ))}

        <Text variant="title2" accessibilityRole="header" style={styles.sectionTitle}>{t('planChange.optionsTitle')}</Text>
        {OPTIONS.map(option => (
          <Card key={option.key} padded={false} style={styles.option}>
            <View style={styles.optionIcon}>
              <Icon name={option.icon} size={18} color="text.secondary" />
            </View>
            <View style={styles.optionText}>
              <Text variant="label" color="text.secondary">{t(`planChange.option.${option.key}`)}</Text>
              <Text variant="bodySmall" color="text.secondary">{t(`planChange.option.${option.key}Body`)}</Text>
            </View>
            <Chip label={t('planChange.soon')} variant="disabled" />
          </Card>
        ))}
        <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite">{t('planChange.unavailable')}</Text>
      </ScrollView>

      <GlassBar placement="floating">
        <View style={styles.actions}>
          <PrimaryBtn label={t('planChange.submit')} disabled onPress={() => undefined} />
          <GhostBtn label={t('common.cancel')} onPress={leave} />
        </View>
      </GlassBar>
    </Atmosphere>
  )
}
