import { useRef, useState } from 'react'
import { Controller, useWatch, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { Me } from '@/shared/api'
import type { MessageKey } from '@/shared/i18n/types'
import { TextInput, type TextInputRef } from '@/shared/ui/text-input'
import { Icon } from '@/shared/ui/icons'
import { Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { formatDateOfBirth, initialBirthdayDate } from './date-of-birth'
import { BirthdaySheet } from './birthday-sheet.view'
import { styles } from './date-of-birth.style'

export function DateOfBirthCard({ profile, control, busy, error, onClear, embedded = false }: {
  embedded?: boolean; profile: Me; control: Control<{ name: string; birthday: string }>; busy: boolean; error?: MessageKey; onClear: () => void
}) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const text = useWatch({ control, name: 'birthday' })
  const input = useRef<TextInputRef>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDate, setPickerDate] = useState(() => initialBirthdayDate(text))
  function openPicker(value: string) {
    if (busy) return
    input.current?.blur()
    setPickerDate(initialBirthdayDate(value))
    setPickerOpen(true)
  }
  const label = formatDateOfBirth(profile.dateOfBirth, i18n.language)
  const Container = embedded ? View : Card
  return (
    <Container padded={false} style={embedded ? styles.embedded : styles.card}>
      {embedded ? <Text variant="introSmall">{t('account.dobTitle')}</Text> : <View style={styles.titleRow}>
        <View style={styles.icon}>
          <Icon name="calendar" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.header}>
          <Text variant="title2" accessibilityRole="header">
            {t('account.dobTitle')}
          </Text>
          <Text variant="bodySmall" color="text.secondary">{t('account.dobBody')}</Text>
        </View>
      </View>}

      {!embedded ? <Text variant={!(label) ? 'body' : label ? 'body' : undefined} color={!(label) ? 'text.secondary' : label ? 'text.primary' : undefined}>
        {label ? t('account.dobCurrent', { date: label }) : t('account.dobUnset')}
      </Text> : null}

      <Controller
        control={control}
        name="birthday"
        render={({ field: { value, onChange, onBlur } }) => (
          <View><View style={styles.inputWrap}><TextInput
            accessibilityLabel={t('account.dobInputLabel')}
            accessibilityHint={t('account.birthdayPickerHint')}
            ref={input}
            onPressIn={() => openPicker(value)}
            onAccessibilityTap={() => openPicker(value)}
            onFocus={() => openPicker(value)}
            showSoftInputOnFocus={false}
            value={value}
            onChangeText={next => {
              onChange(next)
            }}
            onBlur={onBlur}
            placeholder={t('account.dobPlaceholder')}
            placeholderTextColor={theme.text.secondary}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCorrect={false}
            editable={!busy}
            style={[styles.input, embedded && styles.calendarInput, pickerOpen && styles.activeInput]}
          />{embedded ? <View style={styles.calendar}><Icon name="calendar" size={16} color="text.secondary" /></View> : null}</View>
            <BirthdaySheet visible={pickerOpen} date={pickerDate} onChange={setPickerDate}
              onClose={() => setPickerOpen(false)} onConfirm={next => {
                if (busy) return
                onChange(next)
                onBlur()
                setPickerOpen(false)
              }} />
          </View>
        )}
      />
      <Text variant="caption" color="text.secondary">{t(embedded ? 'account.dobBody' : 'account.dobFormat')}</Text>
      {error ? <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" accessibilityRole="alert">{t(error)}</Text> : null}
      {profile.dateOfBirth || text ? <GhostBtn label={t('account.dobClear')} onPress={onClear} disabled={busy || !text} /> : null}
    </Container>
  )
}
