import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Text } from '@/shared/ui/text'
import { TextInput } from '@/shared/ui/text-input'
import { styles } from './room-manage.style'
import { styles as sheetStyles } from './room-edit-fields.style'
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
  return <View testID="room-title-field" style={sheetStyles.fieldGroup}>
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

export function RoomScheduleField({ name, value, onChange, onBlur, disabled, invalid }: RoomEditFieldProps & { name: 'start' | 'end' }) {
  const { t } = useTranslation()
  return <View testID={`room-schedule-${name}`} style={sheetStyles.scheduleColumn}>
    <Text variant="label" numberOfLines={1} style={sheetStyles.scheduleLabel}>{t(name === 'end' ? 'roomSchedule.endShort' : 'roomSchedule.start')}</Text>
    <TextInput accessibilityLabel={t(`roomSchedule.${name}`)} style={styles.scheduleInput}
      value={value} onChangeText={onChange} onBlur={onBlur} editable={!disabled}
      maxLength={16} autoCorrect={false} placeholder={t('roomSchedule.placeholder')} />
    {name === 'end' ? <Text variant="caption" color="text.secondary">{t('common.optional')}</Text> : null}
    {invalid ? <Text variant="caption" color="status.warningText" accessibilityLiveRegion="polite">{t('roomSchedule.invalid')}</Text> : null}
  </View>
}
