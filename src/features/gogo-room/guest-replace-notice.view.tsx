import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { ResultSheet } from '@/shared/ui/result-sheet.view'

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

/** Explicit confirmation; wait for native dismissal before replacing the session. */
export function useConfirmReplaceGuest(): { confirmReplaceGuest: () => Promise<boolean>; dialog: ReactElement } {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const choice = useRef(false)
  useEffect(() => () => { resolver.current?.(false); resolver.current = null }, [])
  const confirmReplaceGuest = useCallback(() => new Promise<boolean>(resolve => {
    if (resolver.current) { resolve(false); return }
    resolver.current = resolve
    choice.current = false
    setVisible(true)
  }), [])
  function close(confirmed: boolean) { choice.current = confirmed; setVisible(false) }
  const dialog = <ResultSheet visible={visible} variant="warning" testID="guest-replace-confirm"
    title={t('guestReplace.confirmTitle')} body={t('guestReplace.confirmBody')}
    secondaryAction={{ label: t('guestReplace.cancel'), onPress: () => close(false) }}
    primaryAction={{ label: t('guestReplace.confirm'), destructive: true, onPress: () => close(true) }}
    onClose={() => close(false)} onClosed={() => {
      const resolve = resolver.current
      resolver.current = null
      resolve?.(choice.current)
    }} />
  return { confirmReplaceGuest, dialog }
}
