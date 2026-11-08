import { usePreventRemove } from '@react-navigation/native'
import { useNavigation } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GhostBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { Text } from '@/shared/ui/text'
import { useImportFlow } from './import-flow-controller'
import { contributionFeedbackKey } from './import-flow'

/** Header, link replacement, and native navigation share the same exit decision. */
export function useContributionExit(saveDraft: () => Promise<boolean>) {
  const { controller, state } = useImportFlow()
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [visible, setVisible] = useState(false)
  const [settling, setSettling] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [handledFeedback, setHandledFeedback] = useState<string | null>(null)
  const pending = useRef<{ leave: () => void; epoch: number; generation: number } | null>(null)
  const choice = useRef<'save' | 'discard' | null>(null)
  const blocked = ['retiring', 'submissionUnknown'].includes(state.phase)

  function requestExit(leave: () => void) {
    const current = controller.getSnapshot()
    if (['retiring', 'submissionUnknown'].includes(current.phase) || pending.current) return
    if (!current.dirty) { leave(); return }
    pending.current = { leave, epoch: current.sessionEpoch, generation: current.flowGeneration }
    choice.current = null
    setSaveFailed(false)
    setVisible(true)
  }
  usePreventRemove(state.dirty || blocked, ({ data }) => requestExit(() => navigation.dispatch(data.action)))

  function close(next: 'save' | 'discard' | null) {
    choice.current = next
    setSettling(true)
    setVisible(false)
  }
  async function onClosed() {
    const target = pending.current
    if (!target) return
    const selected = choice.current
    choice.current = null
    const current = () => {
      const next = controller.getSnapshot()
      return next.sessionEpoch === target.epoch && next.flowGeneration === target.generation
    }
    // Wait for the native modal to close before saving can show result feedback.
    if (current() && selected) {
      if (selected === 'discard') {
        controller.reset(controller.getSnapshot().link)
        target.leave()
      } else if (await saveDraft()) {
        if (current()) target.leave()
      } else if (current()) {
        setHandledFeedback(contributionFeedbackKey(controller.getSnapshot()))
        setSaveFailed(true)
      }
    }
    pending.current = null
    setSettling(false)
  }
  return {
    requestExit,
    feedbackSuppressed: visible || settling || saveFailed || handledFeedback === contributionFeedbackKey(state),
    sheet: <>
      <Sheet visible={visible} onClose={() => close(null)} onClosed={() => { void onClosed() }}
        testID="contribution-exit" header={<Text variant="title2" accessibilityRole="header">{t('placeWizard.exit.title')}</Text>}
        footer={<SheetActions>
          <GhostBtn label={t('common.cancel')} onPress={() => close(null)} />
          <SecondaryBtn label={t('placeWizard.exit.discard')} onPress={() => close('discard')} />
          <PrimaryBtn label={t('placeWizard.save')} onPress={() => close('save')} />
        </SheetActions>}>
        <Text>{t('placeWizard.exit.body')}</Text>
      </Sheet>
      <ResultSheet testID="contribution-exit-failure" visible={saveFailed} variant="error"
        title={t('placeWizard.title')}
        body={state.message === 'newDraft' || state.message === 'saved' || state.message === 'resumed'
          ? t('placeWizard.exit.saveFailed') : t(`placeWizard.lifecycle.${state.message}`)}
        primaryAction={{ label: t('common.close'), onPress: () => setSaveFailed(false) }}
        onClose={() => setSaveFailed(false)} />
    </>,
  }
}
