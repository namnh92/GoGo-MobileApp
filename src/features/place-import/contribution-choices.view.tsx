import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { Chip, PrimaryBtn } from '@/shared/ui/primitives'
import { Sheet } from '@/shared/ui/sheet.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { amenityIcon, collapsedOptions, optionLabel, type ContributionOption } from './contribution-options'
import { styles } from './contribution-wizard.style'

export function ContributionChoices({ options, selected, onChange, title, max, disabled, checklist = false }: {
  options: ContributionOption[]
  selected: string[]
  onChange: (keys: string[]) => void
  title: string
  max?: number
  disabled: boolean
  checklist?: boolean
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const visible = collapsedOptions(options, selected, checklist ? 5 : 6)
  const label = (option: ContributionOption) => optionLabel(option, i18n.language,
    t(`placeWizard.option.${option.key}`, { defaultValue: option.labels?.vi || option.key }))
  const toggle = (key: string) => {
    if (disabled) return
    if (selected.includes(key)) onChange(selected.filter((value) => value !== key))
    else if (max === undefined || selected.length < max) onChange([...selected, key])
  }
  const row = (option: ContributionOption, inSheet = false) => {
    const checked = selected.includes(option.key)
    const locked = disabled || (!checked && max !== undefined && selected.length >= max)
    if (checklist || inSheet) return (
      <Pressable key={option.key} accessibilityRole="checkbox" accessibilityLabel={label(option)}
        accessibilityState={{ checked, disabled: locked }} disabled={locked}
        onPress={() => toggle(option.key)} style={[styles.amenity, checked && styles.selectedAmenity]}>
        {checklist ? <MaterialIcon name={amenityIcon(option.key)} size={18} color="redesign.primaryText" /> : null}
        <Text variant="introSmall" style={styles.amenityLabel}>{label(option)}</Text>
        <MaterialIcon name={checked ? 'checkbox' : 'checkboxBlank'} color="redesign.primaryText" />
      </Pressable>
    )
    return <Chip key={option.key} label={label(option)} appearance="mood"
      variant={checked ? 'selected' : 'default'} disabled={locked} onPress={() => toggle(option.key)} />
  }
  const filtered = options.filter((option) => label(option).toLocaleLowerCase(i18n.language).includes(search.trim().toLocaleLowerCase(i18n.language)))
  const groups = [...new Set(filtered.map((option) => option.group ?? ''))]
  return (
    <View style={styles.section}>
      {!options.length ? <Text>{t('placeWizard.noOptions')}</Text> : null}
      <View style={checklist ? styles.section : styles.row}>
        {visible.map((option) => row(option))}
        {options.length > visible.length ? <Chip
          label={checklist ? t('placeWizard.allAmenities', { count: options.length }) : t('placeWizard.moreOptions', { count: options.length - visible.length })}
          variant={disabled ? 'disabled' : 'default'}
          onPress={() => { setSearch(''); setOpen(true) }} /> : null}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} size="full" appearance="discovery" swipeToClose
        header={<View style={styles.sheetHeader}>
          <Text variant="introHeading">{title}</Text>
          <Text accessibilityLiveRegion="polite">{max === undefined ? t('placeWizard.selectedCount', { count: selected.length }) : t('placeWizard.selectedLimit', { count: selected.length, max })}</Text>
          <TextInput accessibilityLabel={t('placeWizard.searchOptions')} placeholder={t('placeWizard.searchOptions')}
            value={search} onChangeText={setSearch} style={styles.input} />
        </View>}
        footer={<PrimaryBtn label={t('placeWizard.done')} variant="discovery" onPress={() => setOpen(false)} />}>
        <View style={styles.section}>
          {!filtered.length ? <Text>{t('placeWizard.noResults')}</Text> : null}
          {groups.map((group) => <View key={group} style={styles.section}>
            {group ? <Text variant="introHeading">{group}</Text> : null}
            {filtered.filter((option) => (option.group ?? '') === group).map((option) => row(option, true))}
          </View>)}
        </View>
      </Sheet>
    </View>
  )
}
