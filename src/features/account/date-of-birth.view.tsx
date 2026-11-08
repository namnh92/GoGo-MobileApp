import { Controller, useWatch, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { Me } from '@/shared/api'
import type { MessageKey } from '@/shared/i18n/types'
import { TextInput } from '@/shared/ui/text-input'
import { Icon } from '@/shared/ui/icons'
import { Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { formatDateOfBirth } from './date-of-birth'
import { styles } from './date-of-birth.style'

export function DateOfBirthCard({ profile, control, busy, error, onClear }: {
  profile: Me; control: Control<{ name: string; birthday: string }>; busy: boolean; error?: MessageKey; onClear: () => void
}) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const text = useWatch({ control, name: 'birthday' })
  const label = formatDateOfBirth(profile.dateOfBirth, i18n.language)
  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.icon}>
          <Icon name="calendar" size={20} color="accent.onSoft" />
        </View>
        <View style={styles.header}>
          <Text variant="title2" accessibilityRole="header">
            {t('account.dobTitle')}
          </Text>
          <Text variant="bodySmall" color="text.secondary">{t('account.dobBody')}</Text>
        </View>
      </View>

      <Text variant={!(label) ? 'body' : label ? 'body' : undefined} color={!(label) ? 'text.secondary' : label ? 'text.primary' : undefined}>
        {label ? t('account.dobCurrent', { date: label }) : t('account.dobUnset')}
      </Text>

      <Controller
        control={control}
        name="birthday"
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            accessibilityLabel={t('account.dobInputLabel')}
            accessibilityHint={t('account.dobFormat')}
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
            style={styles.input}
          />
        )}
      />
      <Text variant="caption" color="text.secondary">{t('account.dobFormat')}</Text>
      {error ? <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" accessibilityRole="alert">{t(error)}</Text> : null}
      {profile.dateOfBirth || text ? <GhostBtn label={t('account.dobClear')} onPress={onClear} disabled={busy || !text} /> : null}
    </Card>
  )
}
