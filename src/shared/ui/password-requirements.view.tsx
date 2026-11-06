import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { passwordRequirements } from '@/shared/validation/password-policy'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './password-requirements.style'

export function PasswordRequirements({ value }: { value: string }) {
  const { t } = useTranslation()
  const rules = passwordRequirements(value)
  const labels: Record<keyof typeof rules, string> = {
    length: t('auth.requirement.length'),
    upper: t('auth.requirement.upper'),
    lower: t('auth.requirement.lower'),
    digit: t('auth.requirement.digit'),
    special: t('auth.requirement.special'),
  }
  return <View testID="password-requirements" style={styles.list}>{(Object.keys(labels) as (keyof typeof rules)[]).map(rule => {
    const met = rules[rule]
    const text = labels[rule]
    return <View key={rule} testID={`password-requirement-${rule}`} accessibilityLabel={t(met ? 'auth.requirement.met' : 'auth.requirement.unmet', { requirement: text })} style={styles.row}>
      <MaterialIcon name={met ? 'checkCircle' : 'close'} size={14} color={met ? 'redesign.greenText' : 'redesign.outline'} />
      <Text variant="introCaption" color={met ? 'redesign.greenText' : 'redesign.outline'}>{text}</Text>
    </View>
  })}</View>
}
