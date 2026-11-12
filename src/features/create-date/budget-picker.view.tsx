import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import type { BudgetMode } from '@/shared/store/roomStore'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { Chip } from '@/shared/ui/chip.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { Text } from '@/shared/ui/text'
import { BUDGET_TIERS } from './budget-tiers'
import { budgetAmountSchema, formatBudgetInput, parseBudgetInput } from './budget-picker'
import { styles } from './budget-picker.style'

const isTier = (value: number) => BUDGET_TIERS.some(tier => tier.amount === value)

/** The caller owns the numeric value; local state preserves invalid text and
 * keeps custom entry open even when its amount matches a tier. */
export function BudgetPicker({ value, onChange, onBlur, roomType, budgetMode, disabled = false, enforceBounds = true }: {
  value: number
  onChange: (value: number) => void
  onBlur?: () => void
  roomType: 'couple' | 'group'
  budgetMode: BudgetMode
  enforceBounds?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState(() => !isTier(value))
  const [raw, setRaw] = useState<string | null>(null)
  const lastValue = useRef(value)
  useEffect(() => {
    // Profile prefill / conflict reload may replace the caller's value.
    if (!Object.is(lastValue.current, value)) {
      setCustom(!isTier(value))
      setRaw(null)
    }
    lastValue.current = value
  }, [value])
  function change(amount: number) {
    lastValue.current = amount
    onChange(amount)
  }
  const unit = roomType === 'couple' && budgetMode === 'total'
    ? t('createBudget.unit.couple') : budgetUnitLabel(budgetMode, roomType, t)
  const validation = budgetAmountSchema.safeParse(value)
  const errorKey = !validation.success ? validation.error.issues[0]!.message : null
  const error = raw ? t('budgetPicker.format') : custom && enforceBounds && errorKey ? t(errorKey === 'budgetPicker.required' ? 'budgetPicker.required'
    : errorKey === 'budgetPicker.integer' ? 'budgetPicker.integer' : 'budgetPicker.bounds') : undefined

  return <View style={styles.body}>
    <View style={styles.chips}>
      {BUDGET_TIERS.map(tier => <Chip key={tier.key} multiline
        label={`${t(`createBudget.range.${tier.key}`)}${tier.key === 'flexible' ? '' : ` ${unit}`}`}
        variant={!custom && value === tier.amount ? 'selected' : 'default'}
        disabled={disabled} onPress={() => { setCustom(false); setRaw(null); change(tier.amount) }} />)}
      <Chip label={t('budgetPicker.custom')} variant={custom ? 'selected' : 'default'} disabled={disabled}
        onPress={() => { if (!custom) { setCustom(true); setRaw(null); change(NaN) } }} />
    </View>
    {custom ? <LabelledInput label={t('budgetPicker.amount')} icon="payments"
      accessibilityLabel={`${t('budgetPicker.amount')} ${unit}`} keyboardType="number-pad"
      value={raw ?? formatBudgetInput(value)} onChangeText={text => {
        const previous = formatBudgetInput(value)
        // Native typing appends to the displayed grouping (e.g. 6.500 →
        // 6.5000). Only this known digit insertion may regroup a partial group.
        const appended = raw === null && previous.includes('.') && text.startsWith(previous)
          && /^\d$/.test(text.slice(previous.length))
        const amount = parseBudgetInput(appended ? previous.replace(/\./g, '') + text.slice(previous.length) : text)
        setRaw(Number.isFinite(amount) ? null : text)
        change(amount)
      }} onBlur={onBlur}
      placeholder={t('budgetPicker.placeholder')} editable={!disabled} error={error}
      trailing={<Text variant="bodySmall">{t('budgetPicker.currency')} {unit}</Text>} /> : null}
  </View>
}
