import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import type { BudgetMode } from '@/shared/store/roomStore'
import { BudgetOptionCard } from '@/features/create-date/budget-option-card.view'
import { Card, IconBtn } from './primitives'
import { haptic } from './feedback'
import { Text } from './text'
import { SectionLabel } from './section-label.view'
import { styles } from './group-budget-fields.style'

/** Shared count → mode controls. Existing room amounts remain in their chosen unit. */
export function GroupBudgetFields({ count, mode, maxCount, onCountChange, onModeChange, disabled = false }: {
  count: number; mode: BudgetMode; maxCount: number; disabled?: boolean
  onCountChange: (count: number) => void
  onModeChange: (mode: BudgetMode) => void
}) {
  const { t } = useTranslation()
  function step(delta: number) {
    if (disabled || (delta < 0 ? count <= 3 : count >= maxCount)) return
    haptic('select')
    onCountChange(count + delta)
  }
  return <View testID="group-budget-fields" style={styles.fields}>
    <View testID="group-budget-count">
      <SectionLabel>{t('groupSetup.countTitle')}</SectionLabel>
      <Card padded={false} style={styles.stepper}>
        <IconBtn accessibilityLabel={t('groupSetup.decrease')} disabled={disabled || count <= 3} onPress={() => step(-1)}><Text variant="title1">−</Text></IconBtn>
        <Text variant="title1" accessibilityLiveRegion="polite">{t('groupSetup.people', { n: count })}</Text>
        <IconBtn accessibilityLabel={t('groupSetup.increase')} disabled={disabled || count >= maxCount} onPress={() => step(1)}><Text variant="title1">+</Text></IconBtn>
      </Card>
    </View>
    <View testID="group-budget-mode">
      <SectionLabel>{t('groupSetup.budgetBy')}</SectionLabel>
      <View style={styles.modes} accessibilityRole="radiogroup">
        {(['per_person', 'total'] as const).map(value => <BudgetOptionCard key={value} testID={`budget-mode-${value}`}
          title={t(value === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')}
          description={t(value === 'per_person' ? 'groupSetup.perPersonHelp' : 'groupSetup.groupTotalHelp', { n: count })}
          selected={mode === value} disabled={disabled} onPress={() => { haptic('select'); onModeChange(value) }} />)}
      </View>
    </View>
  </View>
}
