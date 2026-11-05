import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { useRoom, type BudgetMode } from '@/shared/store/roomStore'
import { haptic } from '@/shared/ui/feedback'
import { IconCheck } from '@/shared/ui/icons'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { Atmosphere, Card, PrimaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { hitSlop, spacing } from '@/shared/ui/tokens'

import { WizardStep } from './wizard-step.view'
import { styles } from './group-setup.style'

const MIN_PEOPLE = 3
const MAX_PEOPLE = 12

const BUDGET_MODES: { mode: BudgetMode; labelKey: 'groupSetup.perPerson' | 'groupSetup.groupTotal' }[] = [
  { mode: 'per_person', labelKey: 'groupSetup.perPerson' },
  { mode: 'total', labelKey: 'groupSetup.groupTotal' },
]

export default function GroupSetupScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const { participantCount, setParticipantCount, budgetMode, setBudgetMode } = useRoom()

  function step(delta: number) {
    const next = Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, participantCount + delta))
    if (next === participantCount) return
    haptic('select')
    setParticipantCount(next)
  }

  return (
    <Atmosphere>
      <WizardStep step="group-setup" onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text variant="display" style={styles.title}>{t('groupSetup.title')}</Text>

        <Card padded={false} style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            disabled={participantCount <= MIN_PEOPLE}
            accessibilityRole="button"
            accessibilityLabel={t('groupSetup.decrease')}
            hitSlop={hitSlop}
            style={[styles.stepBtn, participantCount <= MIN_PEOPLE && { opacity: 0.3 }]}
          >
            <Text variant="title1">−</Text>
          </Pressable>
          <Text variant="title1" accessibilityLiveRegion="polite">
            {t('groupSetup.people', { n: participantCount })}
          </Text>
          <Pressable
            onPress={() => step(1)}
            disabled={participantCount >= MAX_PEOPLE}
            accessibilityRole="button"
            accessibilityLabel={t('groupSetup.increase')}
            hitSlop={hitSlop}
            style={[styles.stepBtn, styles.stepBtnPlus, participantCount >= MAX_PEOPLE && { opacity: 0.3 }]}
          >
            <Text variant="title1" color="accent.onAccent">+</Text>
          </Pressable>
        </Card>

        <Text variant="title2" style={styles.sectionTitle}>{t('groupSetup.budgetBy')}</Text>
        {/* Which mode is chosen changes what every price in the room means, so
            each option spells out its own meaning instead of leaving it to the
            label alone. */}
        <View style={styles.modes} accessibilityRole="radiogroup">
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
                style={[styles.mode, active && styles.modeActive]}
              >
                <View style={styles.modeBody}>
                  <Text variant="title2" color={active ? 'accent.onSoft' : 'text.primary'}>
                    {t(option.labelKey)}
                  </Text>
                  <Text variant="bodySmall" color="text.secondary" style={styles.modeHelp}>
                    {t(option.mode === 'per_person' ? 'groupSetup.perPersonHelp' : 'groupSetup.groupTotalHelp', {
                      n: participantCount,
                    })}
                  </Text>
                </View>
                {/* Selection is not colour alone. */}
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <IconCheck color={theme.accent.onAccent} size={14} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
      <GlassBar placement="docked" testID="create-footer">
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/location')} />
      </GlassBar>
    </Atmosphere>
  )
}
