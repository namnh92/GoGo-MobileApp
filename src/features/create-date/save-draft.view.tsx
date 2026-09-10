import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'
import { useSession } from '@/shared/providers/session-provider'
import { saveRoomDraft, type DraftStep } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import { GhostBtn } from '@/shared/ui/primitives'

export function SaveDraftButton({ step }: { step: DraftStep }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { session } = useSession()
  const creating = useRoomStore(state => state.creationPending)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (saving || creating) return
    if (session?.kind !== 'user' || !session.userId) {
      Alert.alert(t('draft.signIn'))
      return
    }
    setSaving(true)
    try {
      await saveRoomDraft(session.userId, step)
      router.dismissTo('/(tabs)')
    } catch {
      Alert.alert(t('draft.saveFailed'))
    } finally { setSaving(false) }
  }
  return <GhostBtn label={t(saving ? 'account.saving' : 'draft.save')} onPress={() => void save()} disabled={saving || creating} />
}
