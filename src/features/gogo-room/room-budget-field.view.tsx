import { useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { BUDGET_TIERS } from '@/features/create-date/budget-tiers'
import { budgetAmountSchema } from '@/features/create-date/budget-picker'
import { BudgetPicker } from '@/features/create-date/budget-picker.view'
import { BudgetOptionCard } from '@/features/create-date/budget-option-card.view'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { formatMoney } from '@/shared/pricing/money'
import type { BudgetMode } from '@/shared/store/roomStore'
import { Chip, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { Text } from '@/shared/ui/text'
import { useFieldVisibility } from '@/shared/ui/use-field-visibility'
import { styles } from './room-budget-field.style'

type Choice = { amount: number | null; mode: BudgetMode; custom: boolean }

/** Sheet choices stay local until confirmed; the editor still owns API saves. */
export function RoomBudgetField({ amount, mode, roomType, disabled, onChange }: {
  amount: number
  mode: BudgetMode
  roomType: 'couple' | 'group'
  disabled: boolean
  onChange: (amount: number, mode: BudgetMode) => void
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<Choice | null>(null)
  // Numeric equality still drives dirty state; selection identity is UI only.
  const [confirmedSelection, setConfirmedSelection] = useState<{ amount: number; custom: boolean } | null>(null)
  const unit = roomType === 'couple' && mode === 'total' ? t('createBudget.unit.couple') : budgetUnitLabel(mode, roomType, t)
  const tier = confirmedSelection?.amount === amount && confirmedSelection.custom ? undefined : BUDGET_TIERS.find(tier => tier.amount === amount)
  const title = tier ? `${t(`createBudget.range.${tier.key}`)}${tier.key === 'flexible' ? '' : ` ${unit}`}`
    : amount === 0 ? t('budgetPicker.none') : `${formatMoney(amount, 'VND', 'standard')} ${unit}`
  const description = tier ? t(`createBudget.range.${tier.key}.sub`) : t('budgetPicker.customDescription')
  // Existing out-of-range server amounts can be kept unchanged (F-13).
  const valid = choice !== null && (choice.amount === amount || budgetAmountSchema.safeParse(choice.amount).success)
  function close() { setChoice(null) }
  return <View testID="create-budget-section" style={styles.section}>
    <Text variant="label">{t('roomManage.budgetTitle')}</Text>
    <BudgetOptionCard testID="room-edit-budget-card" summary title={title} description={description}
      hint={t('budgetPicker.changeHint')} disabled={disabled} onPress={() => setChoice({ amount, mode, custom: !tier })} />
    <Sheet testID="room-budget-sheet" visible={choice !== null && !disabled} onClose={close} swipeToClose size="full" scroll={false}
      header={<Text variant="title2" style={styles.heading}>{t('roomManage.budgetTitle')}</Text>}
      footer={<View testID="room-budget-sheet-actions"><SheetActions>
        <View testID="room-budget-sheet-cancel"><SecondaryBtn label={t('common.cancel')} onPress={close} /></View>
        <View testID="room-budget-sheet-confirm"><PrimaryBtn label={t('roomEdit.saveSchedule')} disabled={!valid || disabled}
          onPress={() => {
            if (!valid || disabled || choice?.amount == null) return
            setConfirmedSelection({ amount: choice.amount, custom: choice.custom })
            onChange(choice.amount, choice.mode)
            close()
          }} /></View>
      </SheetActions></View>}>
      {choice ? <BudgetSheetOptions roomType={roomType} choice={choice} originalAmount={amount} onChange={setChoice} /> : null}
    </Sheet>
  </View>
}

function BudgetSheetOptions({ choice, originalAmount, roomType, onChange }: {
  choice: Choice
  originalAmount: number
  roomType: 'couple' | 'group'
  onChange: Dispatch<SetStateAction<Choice | null>>
}) {
  const { t } = useTranslation()
  const { viewportRef, scrollRef, schedule, onScroll, onScrollBeginDrag, field } = useFieldVisibility('room-budget-sheet')
  return <View ref={viewportRef} testID="room-budget-sheet-viewport" collapsable={false} style={styles.flex} onLayout={schedule}>
    <ScrollView ref={scrollRef} testID="room-budget-sheet-scroll" style={styles.flex} contentContainerStyle={styles.options}
      onLayout={schedule} onContentSizeChange={schedule} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag}
      scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {roomType === 'group' ? <View style={styles.modes}>{(['per_person', 'total'] as const).map(mode => <Chip key={mode}
        label={t(mode === 'per_person' ? 'groupSetup.perPerson' : 'groupSetup.groupTotal')}
        variant={choice.mode === mode ? 'selected' : 'default'} onPress={() => onChange(previous => previous ? { ...previous, mode } : null)} />)}</View> : null}
      <BudgetPicker value={choice.amount} onChange={amount => onChange(previous => previous ? { ...previous, amount } : null)} roomType={roomType} budgetMode={choice.mode}
        initialCustom={choice.custom} onCustomSelectionChange={custom => onChange(previous => previous ? { ...previous, custom } : null)}
        enforceBounds={choice.amount !== originalAmount} visibilityField={field} />
    </ScrollView>
  </View>
}
