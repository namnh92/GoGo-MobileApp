import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { isValidElement, useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useSession } from '@/shared/providers/session-provider'
import { clearSavedRoomDraft, saveRoomDraft, type DraftStep } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import { useDialog, type DialogProps } from '@/shared/ui/dialog.view'
import { WizardExitPrompt } from './wizard-exit-prompt.view'
import { cancelWizardRecovery, useWizardModal } from './wizard-modal'

/** Back owns the exit prompt and its save/discard overlay. */
export function useWizardActions({ step }: { step: DraftStep }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { session } = useSession()
  const creating = useRoomStore(state => state.creationPending)
  const [leaving, setLeaving] = useState(false)
  const onLeavingClosed = useWizardModal(leaving)
  const { confirm, dialog } = useDialog({ waitForDismiss: true })

  async function leave(save: boolean) {
    if (creating || leaving) return
    if (save && (session?.kind !== 'user' || !session.userId)) {
      Alert.alert(t('draft.signIn'))
      return
    }
    setLeaving(true)
    try {
      if (save) await saveRoomDraft(session!.userId!, step)
      else { await clearSavedRoomDraft(); useRoomStore.getState().resetDraft() }
      cancelWizardRecovery()
      router.dismissTo('/(tabs)')
    } catch { Alert.alert(t('draft.saveFailed')) }
    finally { setLeaving(false) }
  }

  async function close() {
    if (creating || leaving) return
    const draft = useRoomStore.getState()
    const dirty = Boolean(draft.title || draft.administrativeArea || draft.originLat != null || draft.startTime || draft.durationPreset
      || draft.budgetAmount != null
      || draft.seedPlaces.length || draft.audience !== 'couple'
      || draft.participantCount !== 4)
    if (!dirty) { cancelWizardRecovery(); router.dismissTo('/(tabs)'); return }
    const choice = await confirm({
      title: t('draft.exitTitle'),
      message: t('draft.exitBody'),
      actions: [
        { key: 'keep', label: t('draft.exitStay'), style: 'cancel' },
        { key: 'discard', label: t('draft.exitDiscard'), style: 'destructive' },
        { key: 'save', label: t('draft.exitSave') },
      ],
    })
    if (choice === 'discard') await leave(false)
    else if (choice === 'save') await leave(true)
  }

  const actions = <>
    <BlockingLoadingOverlay visible={leaving} onClosed={onLeavingClosed} />
    {isValidElement<DialogProps>(dialog) ? <WizardExitPrompt {...dialog.props} /> : dialog}
  </>
  return { actions, close, backDisabled: creating || leaving }
}
