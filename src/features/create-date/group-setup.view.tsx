import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useRoom, type BudgetMode } from '@/shared/store/roomStore'
import { haptic } from '@/shared/ui/feedback'
import { Atmosphere, BackHeader, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { colors, hitSlop, spacing } from '@/shared/ui/tokens'

import { WizardActions } from './wizard-actions.view'
import { styles } from './group-setup.style'

const MIN_PEOPLE = 3
const MAX_PEOPLE = 12

const BUDGET_MODES: { mode: BudgetMode; labelKey: 'groupSetup.perPerson' | 'groupSetup.groupTotal' }[] = [
  { mode: 'per_person', labelKey: 'groupSetup.perPerson' },
  { mode: 'total', labelKey: 'groupSetup.groupTotal' },
]

export default function GroupSetupScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { participantCount, setParticipantCount, budgetMode, setBudgetMode } = useRoom()

  function step(delta: number) {
    const next = Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, participantCount + delta))
    if (next === participantCount) return
    haptic('select')
    setParticipantCount(next)
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.dismissTo('/create/type')} right={<WizardActions step="group-setup" />} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{t('groupSetup.title')}</Text>

        <GlassCard style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            disabled={participantCount <= MIN_PEOPLE}
            accessibilityRole="button"
            accessibilityLabel={t('groupSetup.decrease')}
            hitSlop={hitSlop}
            style={[
              styles.stepBtn,
              { backgroundColor: colors.neutral[100] },
              participantCount <= MIN_PEOPLE && { opacity: 0.3 },
            ]}
          >
            <Text style={[styles.stepBtnLabel, { color: colors.neutral[900] }]}>−</Text>
          </Pressable>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {t('groupSetup.people', { n: participantCount })}
          </Text>
          <Pressable
            onPress={() => step(1)}
            disabled={participantCount >= MAX_PEOPLE}
            accessibilityRole="button"
            accessibilityLabel={t('groupSetup.increase')}
            hitSlop={hitSlop}
            style={[
              styles.stepBtn,
              { backgroundColor: colors.brand.coral },
              participantCount >= MAX_PEOPLE && { opacity: 0.3 },
            ]}
          >
            <Text style={[styles.stepBtnLabel, { color: colors.neutral[0] }]}>+</Text>
          </Pressable>
        </GlassCard>

        <Text style={styles.sectionTitle}>{t('groupSetup.budgetBy')}</Text>
        <View style={styles.segmented} accessibilityRole="radiogroup">
          {BUDGET_MODES.map(option => {
            const active = budgetMode === option.mode
            return (
              <Pressable
                key={option.mode}
                onPress={() => {
                  haptic('select')
                  setBudgetMode(option.mode)
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {/* Which mode is chosen changes what every price in the room means, so
            it is spelled out rather than left to the label alone. */}
        <Text style={styles.helper}>
          {t(budgetMode === 'per_person' ? 'groupSetup.perPersonHelp' : 'groupSetup.groupTotalHelp', {
            n: participantCount,
          })}
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/location')} />
      </View>
    </Atmosphere>
  )
}
