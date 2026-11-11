import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import type { AssistantProposalResult } from '@/shared/api'
import { PrimaryBtn } from '@/shared/ui/button.view'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { InfoRows } from './info-rows.view'
import { doneLabel, type RowContext } from './proposal-rows'
import { useProposalRows } from './use-proposal-rows'
import { styles } from './task-summary.style'

/**
 * Design system `TaskSummary`: what changed, in the values the **server**
 * saved (contract `AssistantProposalResult.savedValues`, read back after the
 * write) — not the request. A success disc with a check, and the words.
 */
export function TaskSummary({
  result,
  context,
  onOpenRoom,
}: {
  result: AssistantProposalResult
  context: Omit<RowContext, 't'>
  onOpenRoom: (roomId: string) => void
}) {
  const { t } = useTranslation()
  const rows = useProposalRows(result.savedValues, { ...context, t })
  const roomId = result.resource.type === 'room' ? result.resource.id : result.resource.roomId
  return (
    <View testID="assistant-task-summary" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.disc}>
          <Icon name="check" size={16} color="text.inverse" />
        </View>
        <Text variant="title2" accessibilityRole="header">{doneLabel(result.kind, t)}</Text>
      </View>
      <InfoRows rows={rows} />
      {roomId ? <PrimaryBtn label={t('assistant.card.openPlan')} onPress={() => onOpenRoom(roomId)} /> : null}
    </View>
  )
}
