import { useRouter } from 'expo-router'
import { useCallback, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { useDialog } from '@/shared/ui/dialog.view'

import { GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'

import { styles } from './guest-replace-notice.style'

/**
 * #272 — a guest session is scoped to one room, and joining another as a guest
 * replaces it (`joinAsGuest` purges first). Owner decision 2026-09-22: keep the
 * existing guest session, and confirm before replacing it. Shown on both join
 * screens (invite link, typed code) whenever the device already holds one.
 */
export function GuestReplaceNotice({ guestRoomId }: { guestRoomId: string | null }) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <Text variant="bodySmall">{t('guestReplace.notice')}</Text>
      {guestRoomId ? (
        <GhostBtn label={t('guestReplace.backToRoom')} onPress={() => router.replace(`/room/${guestRoomId}`)} />
      ) : null}
    </View>
  )
}

/**
 * `confirmReplaceGuest()` resolves true only on an explicit "replace and join";
 * a dismissal keeps the session. Render `dialog` in the screen (#381: the
 * in-app Dialog, not `Alert.alert`).
 */
export function useConfirmReplaceGuest(): { confirmReplaceGuest: () => Promise<boolean>; dialog: ReactElement | null } {
  const { t } = useTranslation()
  const { confirm, dialog } = useDialog()
  const confirmReplaceGuest = useCallback(async () => {
    const choice = await confirm({
      title: t('guestReplace.confirmTitle'),
      message: t('guestReplace.confirmBody'),
      actions: [
        { key: 'keep', label: t('guestReplace.cancel'), style: 'cancel' },
        { key: 'replace', label: t('guestReplace.confirm'), style: 'destructive' },
      ],
    })
    return choice === 'replace'
  }, [confirm, t])
  return { confirmReplaceGuest, dialog }
}
