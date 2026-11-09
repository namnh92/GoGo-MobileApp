import Svg, { Circle, Path } from 'react-native-svg'
import { useUnistyles } from 'react-native-unistyles'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Card, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { styles } from './invite-expired.style'

/** Existing recovery routes; no join/claim/session work happens in a dead invite. */
export function InviteExpired({ unusable = false, message, canRequestLink = true }: { unusable?: boolean; message?: string; canRequestLink?: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme } = useUnistyles()
  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}>
      <Card padded={false} style={unusable ? styles.brokenCard : styles.expiredCard} testID={unusable ? 'invite-unusable' : 'invite-expired'}>
        <View style={styles.hero}><View style={styles.heroInner}><Svg width={48} height={48} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {unusable ? <Path d="M7 3 45 41M18 16H13a8 8 0 0 0 0 16h8m9-16h5a8 8 0 0 1 0 16h-2M15 24h7m6 0h6" stroke={theme.accent.primary} strokeWidth={4} fill="none" /> : <>
            <Circle cx={24} cy={24} r={18} stroke={theme.border.hairline} strokeWidth={2.5} fill="none" />
            <Path d="M24 14v10l6.5 4" stroke={theme.accent.primary} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            <Circle cx={34} cy={14} r={3} fill={theme.redesign.violet} />
            <Path d="m12 36 3-3m21 3-3-3" stroke={theme.text.secondary} strokeWidth={2.5} />
          </>}
        </Svg></View></View>
        <Text variant="title1" accessibilityRole="header" style={styles.title}>{t(unusable ? 'inviteState.unusableTitle' : 'guestJoin.expiredTitle')}</Text>
        <Text color="text.secondary" accessibilityLiveRegion="polite" style={styles.body}>{message ?? t(unusable ? 'guestJoin.notFoundBody' : 'guestJoin.expiredBody')}</Text>
        {unusable && canRequestLink ? <View style={styles.guidance}>
          <Text variant="caption" color="text.secondary">{t('inviteState.try')}</Text>
          <View style={styles.tip}><Icon name="mail" color="redesign.violetText" /><Text variant="bodySmall" style={styles.tipText}>{t('inviteState.askLink')}</Text></View>
          <View style={styles.tip}><Icon name="unlock" color="redesign.violetText" /><Text variant="bodySmall" style={styles.tipText}>{t('inviteState.useCode')}</Text></View>
        </View> : null}
        <View style={styles.actions}>
          <PrimaryBtn variant="pill" label={t('guestJoin.expiredHome')} onPress={() => router.replace('/')} icon="home" />
          <SecondaryBtn variant="neutralPill" label={t(unusable ? 'inviteState.manual' : 'inviteState.otherCode')} onPress={() => router.replace('/join')} />
        </View>
      </Card>
    </ScrollView>
  )
}
