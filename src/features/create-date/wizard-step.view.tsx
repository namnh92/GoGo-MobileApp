import { AppHeader } from '@/shared/ui/app-header.view'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { useRoom } from '@/shared/store/roomStore'
import { Text } from '@/shared/ui/text'

import { WizardActions } from './wizard-actions.view'
import { styles } from './wizard-step.style'

/**
 * The wizard's step chrome, in one place.
 *
 * Every step renders this, so adding one never means editing six screens and
 * hoping none says "3 / 4" on its last page. The steps are the path the person
 * is on: a group has the head-count step between the type and the area, a
 * couple does not, so "Bước n / total" counts the steps they will really see.
 */
const COUPLE_STEPS = ['type', 'location', 'time', 'budget', 'mood'] as const
const GROUP_STEPS = ['type', 'group-setup', 'location', 'time', 'budget', 'mood'] as const

export type WizardStepKey = (typeof GROUP_STEPS)[number]

/**
 * Back is always a plain pop: the previous step is below on the stack whether
 * the user walked here or resumed a draft (`DraftResume` pushes the whole
 * path). Leaving the wizard in one move is `WizardActions`' job.
 */
export function WizardStep({ step, onBack }: { step: WizardStepKey; onBack: () => void }) {
  const { t } = useTranslation()
  const { roomType } = useRoom()
  const steps: readonly WizardStepKey[] = roomType === 'group' ? GROUP_STEPS : COUPLE_STEPS
  const index = Math.max(0, steps.indexOf(step))
  const total = steps.length
  const label = t('createWizard.step', { current: index + 1, total })

  return (
    <>
      <View>
        <AppHeader onBack={onBack} title={t('home.createDate')} rightAction={<WizardActions step={step} />} />
      </View>
      {/* The bar repeats the count visually; the label carries it for a screen
          reader, so the bar itself stays decorative. */}
      <View style={styles.progress}>
        <Text variant="label" color="accent.primary" accessibilityLabel={`${index + 1}/${total}`}>{label}</Text>
        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.fill, { width: `${((index + 1) / total) * 100}%` }]} />
        </View>
      </View>
    </>
  )
}
