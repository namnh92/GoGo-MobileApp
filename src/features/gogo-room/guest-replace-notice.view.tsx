import { useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'

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

/** Resolves true only on an explicit "replace and join"; a dismissal keeps the session. */
export function confirmReplaceGuest(t: TFunction): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      t('guestReplace.confirmTitle'),
      t('guestReplace.confirmBody'),
      [
        { text: t('guestReplace.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('guestReplace.confirm'), style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}
