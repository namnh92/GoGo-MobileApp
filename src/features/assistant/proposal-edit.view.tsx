import { SheetActions } from '@/shared/ui/sheet-actions.view'
import { Chip } from '@/shared/ui/chip.view'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import { useUnistyles } from 'react-native-unistyles'

import { GhostBtn, PrimaryBtn } from '@/shared/ui/button.view'
import { Sheet } from '@/shared/ui/sheet.view'
import { Text } from '@/shared/ui/text'

import { formatClock } from './format'
import { parseClock, withClock, type ProposalEdit, type ProposalRow, type ProposalValueLike } from './proposal-rows'
import { styles } from './proposal-edit.style'

/**
 * Changing one value of a proposal before confirming (design: "let the user
 * change it inline"). The sheet edits the same facts the contract carries —
 * times on the proposed day, an amount in VND, a name, a choice — and the
 * card sends only the edited ones with the confirm.
 */
export function ProposalEditSheet({
  row,
  values,
  onSave,
  onClose,
}: {
  row: ProposalRow | null
  values: ProposalValueLike[]
  onSave: (changes: Record<string, unknown>) => void
  onClose: () => void
}) {
  return (
    <Sheet visible={row !== null} onClose={onClose} testID="assistant-proposal-edit">
      {row?.edit ? <EditForm key={row.key} edit={row.edit} values={values} onSave={onSave} onClose={onClose} /> : null}
    </Sheet>
  )
}

function EditForm({
  edit,
  values,
  onSave,
  onClose,
}: {
  edit: ProposalEdit
  values: ProposalValueLike[]
  onSave: (changes: Record<string, unknown>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const get = (field: string) => values.find(value => value.field === field)?.value
  const initial = (): [string, string, string | null] => {
    if (edit.kind === 'time') {
      const start = get('startAt')
      const end = get('endAt')
      return [typeof start === 'string' ? formatClock(start) : '', typeof end === 'string' ? formatClock(end) : '', null]
    }
    if (edit.kind === 'budget') {
      const amount = get('budgetAmount')
      const mode = get('budgetMode')
      return [typeof amount === 'number' ? String(amount) : '', '', typeof mode === 'string' ? mode : null]
    }
    if (edit.kind === 'text') return [String(get(edit.field) ?? ''), '', null]
    const current = get(edit.field)
    return ['', '', typeof current === 'string' ? current : null]
  }
  const [seed] = useState(initial)
  const [first, setFirst] = useState(seed[0])
  const [second, setSecond] = useState(seed[1])
  const [choice, setChoice] = useState<string | null>(seed[2])
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    if (edit.kind === 'time') {
      const startIso = get('startAt')
      const endIso = get('endAt')
      const start = parseClock(first)
      const end = typeof endIso === 'string' ? parseClock(second) : null
      if (!start || (typeof endIso === 'string' && !end) || typeof startIso !== 'string') {
        setError(t('assistant.edit.invalidTime'))
        return
      }
      const changes: Record<string, unknown> = { startAt: withClock(startIso, start) }
      if (end && typeof endIso === 'string') {
        const nextEnd = withClock(startIso, end)
        if (Date.parse(nextEnd) <= Date.parse(changes.startAt as string)) {
          setError(t('assistant.edit.endBeforeStart'))
          return
        }
        changes.endAt = nextEnd
      }
      onSave(changes)
      return
    }
    if (edit.kind === 'budget') {
      const amount = Number(first.replace(/[^\d]/g, ''))
      if (!Number.isInteger(amount) || amount <= 0) {
        setError(t('assistant.edit.invalidAmount'))
        return
      }
      onSave(edit.hasMode && choice ? { budgetAmount: amount, budgetMode: choice } : { budgetAmount: amount })
      return
    }
    if (edit.kind === 'text') {
      const text = first.trim()
      if (!text) {
        setError(t('assistant.edit.invalidText'))
        return
      }
      onSave({ [edit.field]: text })
      return
    }
    if (choice) onSave({ [edit.field]: choice })
  }

  const field = (label: string, value: string, onChange: (text: string) => void, numeric = false) => (
    <View style={styles.field}>
      <Text variant="caption" color="text.secondary">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={text => {
          setError(null)
          onChange(text)
        }}
        keyboardType={numeric ? 'number-pad' : 'default'}
        selectTextOnFocus
        placeholderTextColor={theme.text.secondary}
        style={styles.input}
      />
    </View>
  )

  const chips = (options: { value: string; label: string }[]) => (
    <View style={styles.chips}>
      {options.map(option => (
        <Chip key={option.value} label={option.label} variant={choice === option.value ? 'selected' : 'default'}
          onPress={() => setChoice(option.value)} />
      ))}
    </View>
  )

  return (
    <View style={styles.body}>
      <Text variant="title2" accessibilityRole="header">{t('assistant.edit.title', { field: edit.label })}</Text>
      {edit.kind === 'time' ? (
        <>
          {field(t('assistant.field.startTime'), first, setFirst)}
          {typeof get('endAt') === 'string' ? field(t('assistant.field.endTime'), second, setSecond) : null}
        </>
      ) : null}
      {edit.kind === 'budget' ? (
        <>
          {field(t('assistant.edit.amount'), first, setFirst, true)}
          {edit.hasMode
            ? chips([
                { value: 'total', label: t('assistant.value.total') },
                { value: 'per_person', label: t('assistant.value.perPerson') },
              ])
            : null}
        </>
      ) : null}
      {edit.kind === 'text' ? field(edit.label, first, setFirst) : null}
      {edit.kind === 'choice' ? chips(edit.options) : null}
      {error ? <Text variant="bodySmall" color="status.dangerText" accessibilityRole="alert">{error}</Text> : null}
      <SheetActions>
        <GhostBtn label={t('common.cancel')} onPress={onClose} />
        <PrimaryBtn label={t('assistant.edit.save')} onPress={save} />
      </SheetActions>
    </View>
  )
}
