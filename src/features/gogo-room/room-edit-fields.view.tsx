import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { styles } from './room-manage.style'
import { styles as fieldStyles } from './room-edit-fields.style'
import { styles as wizardStyles } from '@/features/create-date/create-type.style'

export interface RoomEditFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  disabled: boolean
  invalid?: boolean
}

export function RoomTitleField({ value, onChange, onBlur, disabled, invalid }: RoomEditFieldProps) {
  const { t } = useTranslation()
  return <View testID="room-title-field" style={fieldStyles.fieldGroup}>
    <View style={styles.labelRow}>
      <Text variant="label">{t('roomTitle.title')}</Text>
      <Text variant="caption" color="text.secondary">{`${value.length}/80`}</Text>
    </View>
    <TextInput accessibilityLabel={t('roomTitle.title')} style={wizardStyles.nameInput}
      value={value} onChangeText={onChange} onBlur={onBlur} editable={!disabled}
      maxLength={80} placeholder={t('createType.roomNameHint')} />
    {invalid ? <Text variant="caption" color="status.warningText" accessibilityLiveRegion="polite">{t('roomTitle.tooLong')}</Text> : null}
  </View>
}
