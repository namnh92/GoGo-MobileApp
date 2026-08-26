import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocaleContent } from '@/shared/i18n'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-time.style'

export default function CreateTimeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const [selectedIndex, setSelectedIndex] = useState(1)

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>2 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={1} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('createTime.title')}</Text>
        <Text style={styles.body}>{t('createTime.body')}</Text>

        <View style={{ gap: spacing[2], marginBottom: spacing[6] }}>
          {content.timeOptions.map((o, i) => {
            const active = selectedIndex === i
            return (
              <Pressable
                key={o}
                onPress={() => setSelectedIndex(i)}
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={[styles.optionLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>{o}</Text>
              </Pressable>
            )
          })}
        </View>

        <GlassCard style={{ padding: spacing[4] }}>
          <Text style={styles.exactLabel}>{t('createTime.specificTime')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <View style={styles.timeBox}>
              <Text style={styles.timeCaption}>{t('createTime.start')}</Text>
              <Text style={styles.timeValue}>18:30</Text>
            </View>
            <Text style={{ color: colors.neutral[500] }}>→</Text>
            <View style={styles.timeBox}>
              <Text style={styles.timeCaption}>{t('createTime.end')}</Text>
              <Text style={styles.timeValue}>22:00</Text>
            </View>
          </View>
        </GlassCard>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/budget')} />
      </View>
    </Atmosphere>
  )
}
