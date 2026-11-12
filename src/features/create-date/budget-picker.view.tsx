import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import type { BudgetMode } from '@/shared/store/roomStore'
import { formatMoney } from '@/shared/pricing/money'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { Chip } from '@/shared/ui/chip.view'
import { LabelledInput } from '@/shared/ui/labelled-input.view'
import { Text } from '@/shared/ui/text'
import { BUDGET_TIERS } from './budget-tiers'
import { budgetAmountSchema, formatBudgetInput, parseBudgetInput } from './budget-picker'
import { styles } from './budget-picker.style'

const isTier = (value: number | null) => BUDGET_TIERS.some(tier => tier.amount === value)

/** The caller owns the numeric value; local state preserves invalid text and
 * keeps custom entry open even when its amount matches a tier. */
export function BudgetPicker({ value, onChange, onBlur, roomType, budgetMode, disabled = false, enforceBounds = true }: {
  value: number | null
  onChange: (value: number | null) => void
  onBlur?: () => void
  roomType: 'couple' | 'group'
  budgetMode: BudgetMode
  enforceBounds?: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState(() => !isTier(value))
  const [focused, setFocused] = useState(false)
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
  function change(amount: number | null) {
    lastValue.current = amount
    onChange(amount)
  }
  const unit = roomType === 'couple' && budgetMode === 'total'
    ? t('createBudget.unit.couple') : budgetUnitLabel(budgetMode, roomType, t)
  const validation = budgetAmountSchema.safeParse(value)
  const errorKey = !validation.success ? validation.error.issues[0]!.message : null
  const invalidPaste = raw !== null && !Number.isFinite(parseBudgetInput(raw)) && raw !== ''
  const error = invalidPaste ? t('budgetPicker.format') : custom && enforceBounds && errorKey ? t(errorKey === 'budgetPicker.required' ? 'budgetPicker.required'
    : errorKey === 'budgetPicker.format' ? 'budgetPicker.format'
    : errorKey === 'budgetPicker.integer' ? 'budgetPicker.integer' : 'budgetPicker.bounds') : undefined

  return <View style={styles.body}>
    <View style={styles.chips}>
      {BUDGET_TIERS.map(tier => <Chip key={tier.key} multiline
        label={`${t(`createBudget.range.${tier.key}`)}${tier.key === 'flexible' ? '' : ` ${unit}`}`}
        variant={!custom && value === tier.amount ? 'selected' : 'default'}
        disabled={disabled} onPress={() => { setCustom(false); setRaw(null); change(tier.amount) }} />)}
      <Chip label={t('budgetPicker.custom')} variant={custom ? 'selected' : 'default'} disabled={disabled}
        onPress={() => { if (!custom) { setCustom(true); setRaw(null); change(null) } }} />
    </View>
    {custom ? <><LabelledInput label={t('budgetPicker.amount')} icon="payments"
      accessibilityLabel={`${t('budgetPicker.amount')} ${unit}`} keyboardType="number-pad"
      value={invalidPaste ? raw! : focused ? raw ?? (value !== null && Number.isFinite(value) ? String(value) : '') : formatBudgetInput(value)}
      onFocus={() => {
        setFocused(true)
        if (!invalidPaste) setRaw(value !== null && Number.isFinite(value) ? String(value) : '')
      }}
      onChangeText={text => {
        if (/^\d*$/.test(text)) {
          setRaw(text)
          change(text === '' ? null : Number(text))
        } else {
          const amount = parseBudgetInput(text)
          setRaw(Number.isFinite(amount) ? String(amount) : text)
          change(amount)
        }
      }} onBlur={() => { setFocused(false); onBlur?.() }}
      placeholder={t('budgetPicker.placeholder')} editable={!disabled} error={error}
      trailing={<Text variant="bodySmall">{t('budgetPicker.currency')} {unit}</Text>} />
      {value !== null && Number.isFinite(value) && !invalidPaste && (!enforceBounds || validation.success)
        ? <Text variant="bodySmall">{formatMoney(value, 'VND', 'standard')} {unit}</Text> : null}
    </> : null}
  </View>
}
