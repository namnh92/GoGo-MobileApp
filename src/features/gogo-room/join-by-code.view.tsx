import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError, useJoinRoom } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './join-by-code.style'

const MAX_NAME = 50

export default function JoinByCodeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status, joinAsGuest } = useSession()
  const joinRoom = useJoinRoom()
  const forget = useRecentRoomsStore(state => state.forget)

  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // A signed-in user joins as themselves; anyone else joins as a guest and has
  // to say what to call them.
  const asUser = status === 'user'
  const trimmedCode = code.trim()
  const trimmedName = displayName.trim()
  const ready = trimmedCode.length > 0 && (asUser || trimmedName.length > 0)

  function toMessage(caught: unknown): string {
    // 410 covers expired, revoked and spent invites — all mean "ask for a new
    // link", which is a different action from a transient failure.
    if (isApiError(caught) && caught.status === 410) return t('joinByCode.expired')
    if (isApiError(caught) && caught.status === 404) return t('joinByCode.notFound')
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
        track('gogo_partner_joined', { role: 'member' })
        if (result?.roomId) {
          // A room the actor was previously removed from would be stale here.
          forget(result.roomId)
          router.replace(`/room/${result.roomId}`)
        }
      } else {
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
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} title={t('joinByCode.title')} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing[5],
            paddingBottom: insets.bottom + spacing[6],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.body}>{t('joinByCode.body')}</Text>

          <GlassCard style={styles.card}>
            <Text style={styles.label}>{t('joinByCode.codeLabel')}</Text>
            <TextInput
              value={code}
              onChangeText={value => {
                setCode(value)
                if (error) setError(null)
              }}
              placeholder={t('joinByCode.codePlaceholder')}
              placeholderTextColor={colors.neutral[300]}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!pending}
              accessibilityLabel={t('joinByCode.codeLabel')}
              style={styles.input}
            />

            {!asUser ? (
              <>
                <Text style={styles.label}>{t('guestJoin.nameLabel')}</Text>
                <TextInput
                  value={displayName}
                  onChangeText={value => setDisplayName(value.slice(0, MAX_NAME))}
                  placeholder={t('guestJoin.namePlaceholder')}
                  placeholderTextColor={colors.neutral[300]}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!pending}
                  accessibilityLabel={t('guestJoin.nameLabel')}
                  style={styles.input}
                />
              </>
            ) : null}
          </GlassCard>

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={{ marginTop: 'auto', gap: spacing[3] }}>
            <PrimaryBtn
              label={pending ? t('guestJoin.joining') : t('guestJoin.join')}
              onPress={submit}
              loading={pending}
              disabled={!ready}
            />
            {!asUser ? <Text style={styles.footnote}>{t('guestJoin.noAccount')}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Atmosphere>
  )
}
