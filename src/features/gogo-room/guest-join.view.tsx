import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { track } from '@/shared/analytics'
import { useLocaleContent } from '@/shared/i18n'
import { Atmosphere, AvatarCircle, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './guest-join.style'

const { neutral } = colors

export default function GuestJoinScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>()

  function join() {
    track('gogo_partner_joined', { role: 'guest' })
    router.push(`/room/${inviteCode}/preference`)
  }

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing[8], paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}>
        <View style={{ alignItems: 'center', marginBottom: spacing[6] }}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>📩 {t('guestJoin.badge')}</Text>
          </View>
          <Text style={styles.title}>{t('guestJoin.title', { name: 'Max' })}</Text>
        </View>

        <View style={styles.pair}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle label="M" size={64} />
            <Text style={styles.pairName}>Max</Text>
          </View>
          <Text style={{ fontSize: 24 }}>+</Text>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <AvatarCircle emoji="😊" size={64} />
            <Text style={[styles.pairName, { color: neutral[500] }]}>{t('guestJoin.you')}</Text>
          </View>
        </View>

        <GlassCard style={styles.details}>
          <Text style={styles.detailsTitle}>{t('guestJoin.detailsTitle')}</Text>
          {content.dateDetails.map(([icon, text]) => (
            <View key={text} style={styles.detailRow}>
              <Text style={{ fontSize: 18 }}>{icon}</Text>
              <Text style={styles.detailLabel}>{text}</Text>
            </View>
          ))}
        </GlassCard>

        <View style={{ marginTop: 'auto', gap: spacing[3] }}>
          <PrimaryBtn label={t('guestJoin.join')} onPress={join} />
          <Text style={styles.noAccount}>{t('guestJoin.noAccount')}</Text>
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
