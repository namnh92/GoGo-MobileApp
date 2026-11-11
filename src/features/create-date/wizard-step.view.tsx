import { AppHeader } from '@/shared/ui/app-header.view'
import { useTranslation } from 'react-i18next'
import { BackHandler, KeyboardAvoidingView, Platform, View } from 'react-native'
import { createContext, useCallback, useContext, useEffect } from 'react'
import { useFocusEffect } from 'expo-router'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import type { ReactNode } from 'react'

import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { motion } from '@/shared/ui/tokens'

import { useRoom } from '@/shared/store/roomStore'
import { Text } from '@/shared/ui/text'

import { useWizardActions } from './wizard-actions.view'
import { styles } from './wizard-step.style'

/**
 * The wizard's step chrome, in one place.
 *
 * The create layout renders this once, so adding one never means editing six screens and
 * hoping none says "3 / 4" on its last page. The steps are the path the person
 * is on: a group has the head-count step between type/location and time, a
 * couple does not, so "Bước n / total" counts the steps they will really see.
 */
const COUPLE_STEPS = ['type', 'time', 'budget', 'mood'] as const
const GROUP_STEPS = ['type', 'group-setup', 'time', 'budget', 'mood'] as const

export type WizardStepKey = (typeof GROUP_STEPS)[number]
export const WizardHeaderOffset = createContext(0)

/**
 * Later steps pop: the previous step is below on the stack whether
 * the user walked here or resumed a draft (`DraftResume` pushes the whole
 * path). First-step Back shares Close's existing save/discard/keep prompt.
 */
export function WizardStep({ step, onBack }: { step: WizardStepKey; onBack: () => void }) {
  const { t } = useTranslation()
  const { roomType } = useRoom()
  const steps: readonly WizardStepKey[] = roomType === 'group' ? GROUP_STEPS : COUPLE_STEPS
  const index = Math.max(0, steps.indexOf(step))
  const total = steps.length
  const label = t('createWizard.step', { current: index + 1, total })
  const { actions, close, backDisabled } = useWizardActions({ step, compact: true })
  const back = useCallback(() => { if (step === 'type') void close(); else onBack() }, [step, close, onBack])
  useFocusEffect(useCallback(() => {
    if (step !== 'type') return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true })
    return () => subscription.remove()
  }, [step, back]))
  const reduced = useReducedMotionPreference()
  const progress = useSharedValue((index + 1) / total)
  useEffect(() => {
    progress.set(reduced !== false ? (index + 1) / total : withTiming((index + 1) / total, { duration: motion.standard }))
  }, [index, total, reduced, progress])
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` as `${number}%` }))

  return (
    <View testID="wizard-chrome" style={styles.chrome}>
      <View>
        <AppHeader onBack={back} backDisabled={backDisabled} title={t('home.createDate')} rightAction={actions} />
      </View>
      {/* The bar repeats the count visually; the label carries it for a screen
          reader, so the bar itself stays decorative. */}
      <View style={styles.progress}>
        <View style={styles.progressLabels}>
          <Text variant="introSmall" color="text.secondary" style={styles.context}>{t(`createWizard.context.${step}`)}</Text>
          <Text variant="introLabel" color="accent.onSoft" accessibilityLabel={`${index + 1}/${total}`}>{label}</Text>
        </View>
        <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View testID="wizard-progress-fill" style={[styles.fill, fill]} />
        </View>
      </View>
    </View>
  )
}

/** Content only. The nested stack starts below the layout's measured header;
 * keyboardVerticalOffset keeps RN's keyboard calculation in screen coordinates.
 * Each step keeps its GlassBar and scroll/field visibility handlers. */
export function WizardScreen({ step, avoidKeyboard = false, children }: { step: WizardStepKey; avoidKeyboard?: boolean; children: ReactNode }) {
  const headerHeight = useContext(WizardHeaderOffset)
  const content = <View testID="wizard-content" style={styles.content}>{children}</View>
  return avoidKeyboard ? <KeyboardAvoidingView testID={`create-${step}-keyboard`} style={styles.content}
      keyboardVerticalOffset={headerHeight} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView> : content
}
