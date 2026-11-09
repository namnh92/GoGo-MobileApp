import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'
import { useSession } from '@/shared/providers/session-provider'
import { clearSavedRoomDraft, saveRoomDraft, type DraftStep } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import { useDialog } from '@/shared/ui/dialog.view'
import { GhostBtn } from '@/shared/ui/primitives'
import { SaveDraftButton } from './save-draft.view'
import { styles } from './wizard-actions.style'

export function WizardActions({ step }: { step: DraftStep }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { session } = useSession()
  const creating = useRoomStore(state => state.creationPending)
  const [leaving, setLeaving] = useState(false)
  const { confirm, dialog } = useDialog()

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
      router.dismissTo('/(tabs)')
    } catch { Alert.alert(t('draft.saveFailed')) }
    finally { setLeaving(false) }
  }

  async function close() {
    const draft = useRoomStore.getState()
    const dirty = Boolean(draft.title || draft.administrativeArea || draft.originLat != null || draft.startTime || draft.durationPreset
      || draft.budgetAmount != null || draft.moodKeys.length || draft.settingKeys.length
      || draft.spendingStyleKey || draft.seedPlaces.length || draft.audience !== 'couple'
      || draft.participantCount !== 4)
    if (!dirty) { router.dismissTo('/(tabs)'); return }
    const choice = await confirm({
      title: t('draft.exitTitle'),
      message: t('draft.exitBody'),
      actions: [
        { key: 'keep', label: t('draft.keepEditing'), style: 'cancel' },
        { key: 'discard', label: t('draft.discard'), style: 'destructive' },
        { key: 'save', label: t('draft.saveExit') },
      ],
    })
    if (choice === 'discard') await leave(false)
    else if (choice === 'save') await leave(true)
  }

  return <View style={styles.actions}>
    <BlockingLoadingOverlay visible={leaving} />
    <SaveDraftButton step={step} />
    <GhostBtn label={t('draft.close')} onPress={() => void close()} disabled={creating || leaving} />
    {dialog}
  </View>
}
