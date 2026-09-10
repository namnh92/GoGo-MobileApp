import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'

import { useSession } from '@/shared/providers/session-provider'
import { useRoomStore } from '@/shared/store/roomStore'
import { clearSavedRoomDraft, draftStepPath, restoreRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'

import { styles } from './draft-resume.style'

/** Entry back into a saved wizard draft; renders nothing for other accounts. */
export function DraftResume() {
  const { session } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  const snapshot = useSavedRoomDraft(state => state.draft)
  if (!session?.userId || snapshot?.ownerId !== session.userId) return null

  function resume() {
    const step = restoreRoomDraft(session!.userId!)
    if (!step) return
    // Re-enter the steps before the saved one too, so Back walks the wizard
    // rather than falling out of it (expo-router queues the pushes in order).
    for (const route of draftStepPath(step, useRoomStore.getState().audience)) {
      router.push(`/create/${route}`)
    }
  }

  function confirmDelete() {
    Alert.alert(t('draft.delete'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('draft.delete'),
        style: 'destructive',
        onPress: () => {
          void clearSavedRoomDraft().catch(() => Alert.alert(t('draft.saveFailed')))
        },
      },
    ])
  }

  return (
    <View style={styles.actions}>
      <SecondaryBtn label={t('draft.resume')} onPress={resume} style={styles.action} />
      <GhostBtn label={t('draft.delete')} onPress={confirmDelete} style={styles.action} />
    </View>
  )
}
