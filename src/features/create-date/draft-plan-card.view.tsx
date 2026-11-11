import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, type StyleProp, type ViewStyle } from 'react-native'

import { roomScheduleRange } from '@/features/gogo-room/room-schedule'
import { captureSessionScope, SessionCancelledError } from '@/shared/api/session'
import { budgetFact } from '@/shared/pricing/budget-unit'
import { budgetModeFor } from '@/shared/store/roomStore'
import { clearSavedRoomDraft, restoreRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { PlanCard } from '@/shared/ui/plan-card.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'

import { dropStaleDay } from './resume-day'

type SavedDraft = NonNullable<ReturnType<typeof useSavedRoomDraft.getState>['draft']>

/** Plans supplies only the current account's snapshot, in Upcoming. */
export function DraftPlanCard({ draft, style }: { draft: SavedDraft; style?: StyleProp<ViewStyle> }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [deletion, setDeletion] = useState<{ scope: ReturnType<typeof captureSessionScope>; draft: SavedDraft } | null>(null)
  const fields = draft.fields
  const count = fields.audience === 'couple' ? 2 : fields.participantCount
  const range = roomScheduleRange(fields.startAt ?? undefined, fields.endAt ?? undefined, i18n.language)
  // Header-save can precede Continue, which rebuilds the derived instants.
  // Prefer the current inputs, including partial edits; instants are legacy fallback only.
  const inputSchedule = [
    fields.scheduleDay ? new Date(`${fields.scheduleDay}T12:00:00`).toLocaleDateString(i18n.language) : null,
    [fields.startTime, fields.endTime].filter(Boolean).join(' – '),
  ].filter(Boolean).join(' ')
  const schedule = inputSchedule || (range ? [range.start, range.end].filter(Boolean).join(' – ') : '')
  const people = fields.audience === 'couple' ? t('datePlan.for2') : t('groupSetup.people', { n: count })
  const facts = [
    { text: people, spoken: people },
    budgetFact(fields.budgetAmount == null ? undefined : {
      amount: fields.budgetAmount, mode: budgetModeFor(fields.audience, fields.budgetMode), currency: fields.currency,
    }, count, t),
    schedule ? { text: schedule, spoken: schedule } : null,
  ].filter((fact): fact is { text: string; spoken: string } => fact != null)

  function resume() {
    const step = restoreRoomDraft(draft.ownerId)
    if (!step) return
    dropStaleDay()
    // Open one root navigator. Its mounted type entry restores nested history.
    router.push(step === 'type' ? '/create/type' : { pathname: '/create/type', params: { resumeStep: step } })
  }

  async function remove() {
    if (!deletion) return
    setDeletion(null)
    // A changed account lifetime or replaced snapshot cannot be deleted by an
    // older confirmation. Disk writes retain savedRoomDraft's session guard.
    if (useSavedRoomDraft.getState().draft !== deletion.draft) return
    try {
      await clearSavedRoomDraft(deletion.scope)
    } catch (error) {
      if (!(error instanceof SessionCancelledError)) Alert.alert(t('draft.deleteFailed'))
    }
  }

  return <>
    <PlanCard
      testID="plan-card-draft"
      icon={fields.audience === 'couple' ? 'heart' : 'users'}
      title={fields.title.trim() || t('plans.untitled')}
      meta={facts.map(fact => fact.text).join(' · ')}
      metaAccessibilityLabel={facts.map(fact => fact.spoken).join(', ')}
      status={{ label: t('draft.status'), variant: 'default' }}
      onPress={resume}
      trailingAction={{ icon: 'trash', accessibilityLabel: t('draft.delete'), onPress: () => setDeletion({ scope: captureSessionScope(), draft }) }}
      style={style}
    />
    <ResultSheet
      testID="draft-delete-sheet"
      visible={deletion != null}
      variant="warning"
      title={t('draft.delete')}
      body={t('draft.deleteBody')}
      primaryAction={{ label: t('draft.delete'), destructive: true, onPress: () => void remove() }}
      secondaryAction={{ label: t('common.cancel'), onPress: () => setDeletion(null) }}
      onClose={() => setDeletion(null)}
    />
  </>
}
