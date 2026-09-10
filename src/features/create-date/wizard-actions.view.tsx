import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'
import { useSession } from '@/shared/providers/session-provider'
import { clearSavedRoomDraft, saveRoomDraft, type DraftStep } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import { GhostBtn } from '@/shared/ui/primitives'
import { SaveDraftButton } from './save-draft.view'
import { styles } from './wizard-actions.style'

export function WizardActions({ step }: { step: DraftStep }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { session } = useSession()
  const creating = useRoomStore(state => state.creationPending)
  const [leaving, setLeaving] = useState(false)

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

  function close() {
    const draft = useRoomStore.getState()
    const dirty = Boolean(draft.title || draft.areaKey || draft.originLat != null || draft.startTime
      || draft.budgetAmount != null || draft.moodKeys.length || draft.settingKeys.length
      || draft.spendingStyleKey || draft.seedPlaces.length || draft.audience !== 'couple'
      || draft.participantCount !== 4)
    if (!dirty) { router.dismissTo('/(tabs)'); return }
    Alert.alert(t('draft.exitTitle'), t('draft.exitBody'), [
      { text: t('draft.keepEditing'), style: 'cancel' },
      { text: t('draft.discard'), style: 'destructive', onPress: () => { void leave(false) } },
      { text: t('draft.saveExit'), onPress: () => { void leave(true) } },
    ])
  }

  return <View style={styles.actions}>
    <SaveDraftButton step={step} />
    <GhostBtn label={t('draft.close')} onPress={close} disabled={creating || leaving} />
  </View>
}
