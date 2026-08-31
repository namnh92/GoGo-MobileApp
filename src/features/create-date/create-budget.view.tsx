import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoom, useRoomStore } from '@/shared/store/roomStore'
import { Atmosphere, PrimaryBtn, glassStyles } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'
import { colors, spacing, onDark } from '@/shared/ui/tokens'
import { BUDGET_TIERS, DEFAULT_BUDGET_TIER, type BudgetTier } from './budget-tiers'
import { WizardStep } from './wizard-step.view'
import { styles } from './create-budget.style'

export default function CreateBudgetScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomType, budgetMode } = useRoom()
  const patchDraft = useRoomStore(state => state.patchDraft)
  const [selected, setSelected] = useState<BudgetTier>(DEFAULT_BUDGET_TIER)

  function next() {
    // The amount is what the API constrains on; the tier key is presentation.
    patchDraft({ budgetAmount: selected.amount })
    router.push('/create/mood')
  }

  // Group budget carries its scope explicitly — no couple copy on group flows.
  const subtitle =
    roomType === 'group'
      ? t(budgetMode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')
      : t('createBudget.body')

  return (
    <Atmosphere>
      <WizardStep step="budget" onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{roomType === 'group' ? t('groupSetup.budgetBy') : t('createBudget.title')}</Text>
        <Text style={styles.body}>{subtitle}</Text>

        <View style={{ gap: spacing[2] }}>
          {BUDGET_TIERS.map(tier => {
            const active = selected.key === tier.key
            return (
              <Pressable
                key={tier.key}
                onPress={() => setSelected(tier)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>
                    {t(`createBudget.tier.${tier.key}`)}
                  </Text>
                  <Text style={[styles.optionSub, { color: active ? onDark.medium : colors.neutral[500] }]}>
                    {t(`createBudget.tier.${tier.key}.sub`)}
                  </Text>
                </View>
                {active && (
                  <View style={styles.checkBubble}>
                    <IconCheck color={colors.neutral[0]} size={12} />
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6], paddingTop: spacing[4] }}>
        <PrimaryBtn label={t('common.continue')} onPress={next} />
      </View>
    </Atmosphere>
  )
}
