import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { IconCheck, IconMapPin, IconSearch } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-location.style'

const radii = ['2 km', '5 km', '10 km', 'Anywhere']

export default function CreateLocationScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [radiusChoice, setRadiusChoice] = useState('5 km')

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>1 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={0} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('createLocation.title')}</Text>
        <Text style={styles.body}>{t('createLocation.body')}</Text>

        <GlassCard style={styles.rowCard}>
          <View style={[styles.rowIcon, { backgroundColor: colors.brand.coralSoft }]}>
            <IconMapPin />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('createLocation.current')}</Text>
            <Text style={styles.rowSub}>Thảo Điền, TP.HCM</Text>
          </View>
          <IconCheck />
        </GlassCard>

        <GlassCard style={[styles.rowCard, { opacity: 0.5 }]}>
          <View style={[styles.rowIcon, { backgroundColor: colors.neutral[100] }]}>
            <IconSearch />
          </View>
          <Text style={[styles.rowTitle, { color: colors.neutral[500] }]}>{t('createLocation.searchOther')}</Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('createLocation.maxDistance')}</Text>
        <View style={styles.grid}>
          {radii.map(r => {
            const active = radiusChoice === r
            return (
              <Pressable
                key={r}
                onPress={() => setRadiusChoice(r)}
                accessibilityState={{ selected: active }}
                style={[styles.radiusBtn, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <Text style={[styles.radiusLabel, { color: active ? colors.neutral[0] : colors.neutral[500] }]}>{r}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/time')} />
      </View>
    </Atmosphere>
  )
}
