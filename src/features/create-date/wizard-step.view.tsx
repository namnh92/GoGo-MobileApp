import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BackHeader, ProgressDots } from '@/shared/ui/primitives'

import { SaveDraftButton } from './save-draft.view'
import { styles } from './wizard-step.style'

/**
 * The wizard's step chrome, in one place.
 *
 * Four screens each rendered their own `BackHeader` + hard-coded "3 / 4" +
 * `ProgressDots total={4}`. Adding a step meant editing four files and hoping
 * none was missed — which is how a wizard ends up saying "3 / 4" on its last
 * screen.
 */
export const WIZARD_STEPS = ['location', 'time', 'budget', 'mood'] as const

export type WizardStepKey = (typeof WIZARD_STEPS)[number]

export function WizardStep({ step, onBack }: { step: WizardStepKey; onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const index = WIZARD_STEPS.indexOf(step)
  const total = WIZARD_STEPS.length

  return (
    <>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader
          onBack={onBack}
          right={
            <View>
              <Text style={styles.stepLabel} accessibilityLabel={`${index + 1}/${total}`}>
                {index + 1} / {total}
              </Text>
              <SaveDraftButton step={step} />
            </View>
          }
        />
      </View>
      {/* The dots repeat the count visually; the label carries it for a screen
          reader, so the dots themselves stay decorative. */}
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ProgressDots total={total} current={index} />
      </View>
    </>
  )
}
