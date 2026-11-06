import { useRef, useState } from 'react'
import { Keyboard, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useUnistyles } from 'react-native-unistyles'
import { isApiError, useJoinRoom } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useConfirmReplaceGuest } from '@/features/gogo-room/guest-replace-notice.view'
import { PrimaryBtn, SecondaryBtn } from '@/shared/ui/button.view'
import { FieldFocusGroup } from '@/shared/ui/field-focus-group'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { track } from '@/shared/analytics'
import { styles } from './home.style'

/** Home owns the missing-name sheet; the room index resolves the destination. */
export function QuickJoin({ knownName }: { knownName?: string | null }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const router = useRouter()
  const { status, joinAsGuest } = useSession()
  const join = useJoinRoom()
  const { confirmReplaceGuest, dialog } = useConfirmReplaceGuest()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [nameOpen, setNameOpen] = useState(false)
  const continueAfterClose = useRef(false)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy.current || !code.trim() || status === 'hydrating') return
    const displayName = (name || knownName || '').trim()
    if (status !== 'user' && !displayName) { setNameOpen(true); return }
    busy.current = true
    setPending(true)
    setError(null)
    Keyboard.dismiss()
    try {
      if (status === 'guest' && !(await confirmReplaceGuest())) return
      const result = status === 'user'
        ? await join.mutateAsync({ inviteCode: code.trim() })
        : await joinAsGuest({ inviteCode: code.trim(), displayName })
      if ('alreadyMember' in result && result.alreadyMember === false) track('gogo_partner_joined', { role: 'member' })
      if (status !== 'user') track('gogo_partner_joined', { role: 'guest' })
      if (result.roomId) {
        useRecentRoomsStore.getState().forget(result.roomId)
        router.push(`/room/${result.roomId}`)
      }
    } catch (caught) {
      setError(isApiError(caught)
        ? caught.code === 'ROOM_NOT_JOINABLE' ? t('joinByCode.roomNotJoinable')
          : caught.code === 'ROOM_EXPIRED' ? t('joinByCode.roomExpired')
          : caught.status === 410 ? t('joinByCode.expired')
          : caught.status === 404 ? t('joinByCode.notFound')
          : caught.status === 429 ? t('auth.rateLimited') : t('joinByCode.failed')
        : t('joinByCode.failed'))
    } finally { busy.current = false; setPending(false) }
  }
  return <>
    <View style={styles.join}>
      <View style={styles.joinHeading}><MaterialIcon name="room" color="redesign.violetText" size={18} /><Text variant="introLabel">{t('discovery.joinTitle')}</Text></View>
      <View style={styles.joinRow}>
        <TextInput value={code} onChangeText={value => { setCode(value); setError(null) }} editable={!pending} autoCapitalize="none" autoCorrect={false}
          accessibilityLabel={t('joinByCode.codeLabel')} placeholder={t('discovery.inviteCode')} placeholderTextColor={theme.redesign.secondary} style={styles.joinInput} onSubmitEditing={() => void submit()} />
        <SecondaryBtn variant="discoveryJoin" label={t('discovery.enterRoom')} onPress={() => void submit()} disabled={!code.trim() || status === 'hydrating'} loading={pending} trailingIcon="arrowRight" style={styles.joinButton} />
      </View>
      {error ? <Text variant="introSmall" color="status.dangerText" accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
    <Sheet visible={nameOpen} onClose={() => { continueAfterClose.current = false; setNameOpen(false) }} onClosed={() => {
      if (continueAfterClose.current) { continueAfterClose.current = false; void submit() }
    }}>
      <FieldFocusGroup><Text variant="introHeading">{t('guestJoin.nameLabel')}</Text>
      <TextInput value={name} onChangeText={setName} maxLength={50} accessibilityLabel={t('guestJoin.nameLabel')} placeholder={t('guestJoin.namePlaceholder')} style={[styles.joinInput, { flex: 0 }]} />
      <Text variant="introSmall" color="redesign.secondary">{t('guestJoin.noAccount')}</Text></FieldFocusGroup>
      <PrimaryBtn label={t('discovery.enterRoom')} disabled={!name.trim()} onPress={() => { Keyboard.dismiss(); continueAfterClose.current = true; setNameOpen(false) }} />
    </Sheet>
    {dialog}
  </>
}
