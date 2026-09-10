import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'
import { useSession } from '@/shared/providers/session-provider'
import { clearSavedRoomDraft, restoreRoomDraft, useSavedRoomDraft } from '@/shared/store/savedRoomDraft'
import { GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'

export function DraftResume() {
  const { session } = useSession()
  const { t } = useTranslation()
  const router = useRouter()
  const snapshot = useSavedRoomDraft(state => state.draft)
  if (!session?.userId || snapshot?.ownerId !== session.userId) return null
  return <View>
    <SecondaryBtn label={t('draft.resume')} onPress={() => {
      const step = restoreRoomDraft(session.userId!)
      if (step) router.push(`/create/${step}`)
    }} />
    <GhostBtn label={t('draft.delete')} onPress={() => {
      Alert.alert(t('draft.delete'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('draft.delete'), style: 'destructive', onPress: () => {
          void clearSavedRoomDraft().catch(() => Alert.alert(t('draft.saveFailed')))
        } },
      ])
    }} />
  </View>
}
