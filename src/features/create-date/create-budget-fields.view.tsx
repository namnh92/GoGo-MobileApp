import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { BudgetPicker } from './budget-picker.view'
import { WizardStepHeader } from './wizard-step-header.view'

/** Shared wizard budget body. The picker and optional profile offer stay controlled. */
export function CreateBudgetFields({ roomType, participantCount, budgetMode, children, picker }: {
  roomType: 'couple' | 'group'
  participantCount: number
  budgetMode: 'per_person' | 'total'
  children?: ReactNode
  picker: Omit<ComponentProps<typeof BudgetPicker>, 'roomType' | 'budgetMode'>
}) {
  const { t } = useTranslation()
  return <View testID="create-budget-section">
    <WizardStepHeader title={t(roomType === 'group' ? 'groupSetup.budgetBy' : 'createBudget.title')}
      subtitle={t(roomType === 'group'
        ? budgetMode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal' : 'createBudget.body', { n: participantCount })} />
    {children}
    <BudgetPicker {...picker} roomType={roomType} budgetMode={budgetMode} />
  </View>
}
