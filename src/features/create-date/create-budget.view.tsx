import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocaleContent } from '@/shared/i18n'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, PrimaryBtn, ProgressDots, glassStyles } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './create-budget.style'

export default function CreateBudgetScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const content = useLocaleContent()
  const { roomType, budgetMode } = useRoom()
  const [selectedIndex, setSelectedIndex] = useState(2)

  // Group budget carries its scope explicitly — no couple copy on group flows.
  const subtitle =
    roomType === 'group'
      ? t(budgetMode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')
      : t('createBudget.body')

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} right={<Text style={styles.stepLabel}>3 / 4</Text>} />
      </View>
      <View style={{ paddingHorizontal: spacing[5], paddingBottom: spacing[4] }}>
        <ProgressDots total={4} current={2} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <Text style={styles.title}>{roomType === 'group' ? t('groupSetup.budgetBy') : t('createBudget.title')}</Text>
        <Text style={styles.body}>{subtitle}</Text>

        <View style={{ gap: spacing[2] }}>
          {content.budgetOptions.map((o, i) => {
            const active = selectedIndex === i
            return (
              <Pressable
                key={o.label}
                onPress={() => setSelectedIndex(i)}
                accessibilityState={{ selected: active }}
                style={[styles.option, active ? { backgroundColor: colors.brand.coral } : glassStyles.card]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: active ? colors.neutral[0] : colors.neutral[900] }]}>{o.label}</Text>
                  <Text style={[styles.optionSub, { color: active ? 'rgba(255,255,255,0.8)' : colors.neutral[500] }]}>{o.sub}</Text>
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
        <PrimaryBtn label={t('common.continue')} onPress={() => router.push('/create/mood')} />
      </View>
    </Atmosphere>
  )
}
