import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoom, type BudgetMode } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './group-setup.style'

const MIN_PEOPLE = 3
const MAX_PEOPLE = 12

export default function GroupSetupScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { participantCount, setParticipantCount, budgetMode, setBudgetMode } = useRoom()

  const budgetModes: { mode: BudgetMode; labelKey: 'groupSetup.perPerson' | 'groupSetup.groupTotal' }[] = [
    { mode: 'per_person', labelKey: 'groupSetup.perPerson' },
    { mode: 'total', labelKey: 'groupSetup.groupTotal' },
  ]

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('groupSetup.title')}</Text>

        <GlassCard style={styles.stepper}>
          <Pressable
            onPress={() => setParticipantCount(Math.max(MIN_PEOPLE, participantCount - 1))}
            disabled={participantCount <= MIN_PEOPLE}
            accessibilityLabel="−1"
            style={[styles.stepBtn, { backgroundColor: colors.neutral[100] }, participantCount <= MIN_PEOPLE && { opacity: 0.3 }]}
          >
            <Text style={[styles.stepBtnLabel, { color: colors.neutral[900] }]}>−</Text>
          </Pressable>
          <Text style={styles.count}>{t('groupSetup.people', { n: participantCount })}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setParticipantCount(Math.min(MAX_PEOPLE, participantCount + 1))}
            disabled={participantCount >= MAX_PEOPLE}
            accessibilityLabel="+1"
            style={[styles.stepBtn, { backgroundColor: colors.brand.coral }, participantCount >= MAX_PEOPLE && { opacity: 0.3 }]}
          >
            <Text style={[styles.stepBtnLabel, { color: colors.neutral[0] }]}>+</Text>
          </Pressable>
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('groupSetup.budgetBy')}</Text>
        <View style={{ gap: spacing[2] }}>
          {budgetModes.map(b => {
            const active = budgetMode === b.mode
            return (
              <Pressable
                key={b.mode}
                onPress={() => setBudgetMode(b.mode)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.modeBtn, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <View style={[styles.radio, { borderColor: active ? colors.neutral[0] : colors.neutral[300] }]}>
                  {active && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.modeLabel, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>{t(b.labelKey)}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/location')} />
      </View>
    </Atmosphere>
  )
}
