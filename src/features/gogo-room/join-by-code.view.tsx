import * as Clipboard from 'expo-clipboard'
import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, isOffline, useJoinRoom } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, Card, PrimaryBtn, SecondaryBtn, IconBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { GuestReplaceNotice, useConfirmReplaceGuest } from './guest-replace-notice.view'
import { styles } from './join-by-code.style'

const MAX_NAME = 50

export default function JoinByCodeScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { confirmReplaceGuest, dialog } = useConfirmReplaceGuest()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status, guestRoomId, joinAsGuest } = useSession()
  const joinRoom = useJoinRoom()
  const forget = useRecentRoomsStore(state => state.forget)

  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // A signed-in user joins as themselves; anyone else joins as a guest and has
  // to say what to call them.
  const asUser = status === 'user'
  // #272: a guest session already on this device is replaced only on confirmation.
  const holdsGuestRoom = status === 'guest'
  const trimmedCode = code.trim()
  const trimmedName = displayName.trim()
  const ready = trimmedCode.length > 0 && (asUser || trimmedName.length > 0)

  function toMessage(caught: unknown): string {
    // GoGo-MobileApp#248 — a room that no longer takes members is not an
    // expired code, and asking the host for a new one would not help.
    if (isApiError(caught) && caught.code === 'ROOM_NOT_JOINABLE') return t('joinByCode.roomNotJoinable')
    // A room past its expiry (`ROOM_EXPIRED`) is not coming back either.
    if (isApiError(caught) && caught.code === 'ROOM_EXPIRED') return t('joinByCode.roomExpired')
    // Expired, revoked or spent (`INVITE_NOT_USABLE`); any other 410 as before.
    if (isApiError(caught) && caught.status === 410) return t('joinByCode.expired')
    if (isApiError(caught) && caught.status === 404) return t('joinByCode.notFound')
    if (isOffline(caught)) return t('common.offlineBody')
    if (isApiError(caught) && caught.status === 429) return t('auth.rateLimited')
    return t('joinByCode.failed')
  }

  async function submit() {
    if (!ready) return
    setPending(true)
    setError(null)
    try {
      if (asUser) {
        const result = await joinRoom.mutateAsync({ inviteCode: trimmedCode })
        // GoGo-BE#607: count a join only when the server says this request created
        // the membership. A member or the host reopening the invite gets
        // `alreadyMember: true`; a server older than alpha.49 sends no flag, which is
        // unknown, not a new join.
        if (result?.alreadyMember === false) track('gogo_partner_joined', { role: 'member' })
        if (result?.roomId) {
          // A room the actor was previously removed from would be stale here.
          forget(result.roomId)
          router.replace(`/room/${result.roomId}`)
        }
      } else {
        if (holdsGuestRoom && !(await confirmReplaceGuest())) return
        const session = await joinAsGuest({ inviteCode: trimmedCode, displayName: trimmedName })
        track('gogo_partner_joined', { role: 'guest' })
        if (session.roomId) router.replace(`/room/${session.roomId}/preference`)
      }
    } catch (caught) {
      setError(toMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <Atmosphere>
      <BlockingLoadingOverlay visible={pending} />
      <View>
        <AppHeader onBack={() => router.back()} title={t('joinByCode.title')} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            ...styles.content,
            paddingBottom: insets.bottom + spacing[6],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="bodySmall" color="text.secondary" style={styles.body}>{t('joinByCode.body')}</Text>

          {holdsGuestRoom ? <GuestReplaceNotice guestRoomId={guestRoomId} /> : null}

          <Card padded={false} style={styles.card}>
            <View style={styles.labelRow}>
              <Icon name="unlock" size={20} color="accent.primary" />
              <Text variant="title2">{t('joinByCode.codeLabel')}</Text>
            </View>
            <View style={styles.codeRow}>
            <TextInput
              value={code}
              onChangeText={value => {
                setCode(value)
                if (error) setError(null)
              }}
              placeholder={t('joinByCode.codePlaceholder')}
              placeholderTextColor={theme.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!pending}
              accessibilityLabel={t('joinByCode.codeLabel')}
              style={[styles.input, styles.codeInput]}
            />
            {code ? <IconBtn accessibilityLabel={t('inviteCode.clear')} disabled={pending} onPress={() => setCode('')}><Icon name="x" /></IconBtn> : null}
            <SecondaryBtn variant="neutralPill" label={t('inviteCode.paste')} disabled={pending} onPress={() => { void Clipboard.getStringAsync().then(value => { setCode(value); setError(null) }).catch(() => setError(t('inviteCode.pasteFailed'))) }} />
            </View>

            {!asUser ? (
              <>
                <Text variant="label">{t('guestJoin.nameLabel')}</Text>
                <TextInput
                  value={displayName}
                  onChangeText={value => setDisplayName(value.slice(0, MAX_NAME))}
                  placeholder={t('guestJoin.namePlaceholder')}
                  placeholderTextColor={theme.text.secondary}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!pending}
                  accessibilityLabel={t('guestJoin.nameLabel')}
                  style={styles.input}
                />
              </>
            ) : null}
          </Card>

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert" size={18} color="status.dangerText" />
              <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          {!asUser ? <View style={styles.tip}><Icon name="lock" color="status.successText" /><View style={styles.tipText}><Text variant="label">{t('inviteCode.instant')}</Text><Text variant="caption" color="text.secondary">{t('guestJoin.noAccount')}</Text></View></View> : null}

          <View style={styles.actions}>
            <PrimaryBtn
              variant="pill"
              label={pending ? t('guestJoin.joining') : t('inviteCode.join')}
              onPress={submit}
              icon="arrowRight"
              loading={pending}
              disabled={!ready}
            />
            {!asUser ? <Text variant="caption" color="text.secondary" style={styles.footnote}>{t('guestJoin.noAccount')}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {dialog}
    </Atmosphere>
  )
}
