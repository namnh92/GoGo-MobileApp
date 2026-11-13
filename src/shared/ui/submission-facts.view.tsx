import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatMinuteOfDay, openStateFromHours, vietnamClock } from '@/shared/api/view-models'
import type { components } from '@/shared/api/types'
import { usePlaceClock } from './use-place-clock'
import { Text } from './text'

type Hours = components['schemas']['SubmissionProviderDisplay']['openingHours']

/** Provider-local current state and today's schedule share the canonical hours helpers. */
export function SubmissionHours({ hours }: { hours?: Hours }) {
  const { t } = useTranslation()
  const now = usePlaceClock()
  if (!hours?.length) return null
  const state = openStateFromHours(hours, now)
  const today = hours.filter(entry => entry.dayOfWeek === vietnamClock(now).day)
  const schedule = today.map(entry => `${formatMinuteOfDay(entry.openMinute)}–${formatMinuteOfDay(entry.closeMinute)}`).join(', ')
  return <View testID="submission-hours">
    <Text variant="bodySmall" color={state.openNow ? 'status.successText' : 'status.dangerText'}>{t(state.openNow ? 'common.open' : 'common.closed')}</Text>
    {schedule ? <Text variant="bodySmall">{t('submissionDetail.todayHours', { hours: schedule })}</Text> : null}
  </View>
}
