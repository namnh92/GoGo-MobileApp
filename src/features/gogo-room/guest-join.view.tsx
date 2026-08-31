import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isApiError } from '@/shared/api'
import { track } from '@/shared/analytics'
import { useSession } from '@/shared/providers/session-provider'
import { Atmosphere, AvatarCircle, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'

import { styles } from './guest-join.style'

const { neutral } = colors

const MAX_DISPLAY_NAME = 50

export default function GuestJoinScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { joinAsGuest } = useSession()
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>()

  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = displayName.trim()

  async function join() {
    if (!trimmedName) {
      setError(t('guestJoin.nameRequired'))
      return
    }
    if (!inviteCode) {
      setError(t('guestJoin.notFoundBody'))
      return
    }

    setPending(true)
    setError(null)
    try {
      // Issues a room-scoped guest session and persists it to the Keychain —
      // no account, and the token reaches no other room.
      const session = await joinAsGuest({ inviteCode, displayName: trimmedName })
      track('gogo_partner_joined', { role: 'guest' })
      // Routes carry the room id from here on; the invite code is a credential.
      router.replace(`/room/${session.roomId}/preference`)
    } catch (caught) {
      // 410 covers expired, revoked and spent invites — all mean "ask for a new
      // link", which is a different action from a transient failure.
      if (isApiError(caught) && caught.status === 410) setError(t('guestJoin.expiredBody'))
      else if (isApiError(caught) && caught.status === 404) setError(t('guestJoin.notFoundBody'))
      else setError(t('guestJoin.failed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Atmosphere>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing[8],
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + spacing[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: spacing[6] }}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>📩 {t('guestJoin.badge')}</Text>
          </View>
          <Text style={styles.title}>{t('guestJoin.title')}</Text>
        </View>

        <View style={styles.pair}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="🎉" size={64} />
          </View>
          <Text style={{ fontSize: 24 }}>+</Text>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="😊" size={64} />
            <Text style={[styles.pairName, { color: neutral[500] }]}>{t('guestJoin.you')}</Text>
          </View>
        </View>

        <GlassCard style={styles.details}>
          <Text style={styles.detailsTitle}>{t('guestJoin.nameLabel')}</Text>
          <TextInput
            value={displayName}
            onChangeText={value => {
              setDisplayName(value)
              if (error) setError(null)
            }}
            placeholder={t('guestJoin.namePlaceholder')}
            placeholderTextColor={neutral[300]}
            maxLength={MAX_DISPLAY_NAME}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={join}
            editable={!pending}
            accessibilityLabel={t('guestJoin.nameLabel')}
            style={styles.nameInput}
          />
        </GlassCard>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: 'auto', gap: spacing[3] }}>
          <PrimaryBtn
            label={pending ? t('guestJoin.joining') : t('guestJoin.join')}
            onPress={join}
            loading={pending}
            disabled={!trimmedName}
          />
          <Text style={styles.noAccount}>{t('guestJoin.noAccount')}</Text>
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
