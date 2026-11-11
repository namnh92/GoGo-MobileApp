import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'
import { useSession } from '@/shared/providers/session-provider'
import { saveRoomDraft, type DraftStep } from '@/shared/store/savedRoomDraft'
import { useRoomStore } from '@/shared/store/roomStore'
import { GhostBtn, IconBtn } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'

import { cancelWizardRecovery, useWizardModal } from './wizard-modal'

export function SaveDraftButton({ step, compact = false }: { step: DraftStep; compact?: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const { session } = useSession()
  const creating = useRoomStore(state => state.creationPending)
  const [saving, setSaving] = useState(false)
  const onSavingClosed = useWizardModal(saving)
  async function save() {
    if (saving || creating) return
    if (session?.kind !== 'user' || !session.userId) {
      Alert.alert(t('draft.signIn'))
      return
    }
    setSaving(true)
    try {
      await saveRoomDraft(session.userId, step)
      cancelWizardRecovery()
      router.dismissTo('/(tabs)')
    } catch {
      Alert.alert(t('draft.saveFailed'))
    } finally { setSaving(false) }
  }
  return <>
    <BlockingLoadingOverlay visible={saving} onClosed={onSavingClosed} />
    {compact ? <IconBtn size="regular" accessibilityLabel={t(saving ? 'account.saving' : 'draft.save')} onPress={() => void save()} disabled={saving || creating}><MaterialIcon name="save" size={20} /></IconBtn> : <GhostBtn label={t(saving ? 'account.saving' : 'draft.save')} onPress={() => void save()} disabled={saving || creating} loading={saving} />}
  </>
}
