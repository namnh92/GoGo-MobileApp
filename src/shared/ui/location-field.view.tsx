import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'

import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './location-field.style'

/** Wizard-sized area input. The compact Home/Discovery LocationRow stays separate. */
export function LocationField({ label, onPress, testID }: { label: string | null; onPress: () => void; testID?: string }) {
  const { t } = useTranslation()
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t('home.chooseArea')}
      accessibilityValue={label ? { text: label } : undefined} onPress={onPress} style={styles.field}>
      <MaterialIcon name="location" size={20} color="text.secondary" />
      <Text variant="body" color={label ? 'text.primary' : 'text.secondary'} style={styles.label}
        numberOfLines={1} ellipsizeMode="tail">{label || t('home.chooseArea')}</Text>
      <MaterialIcon name="chevronRight" size={20} color="text.secondary" />
    </Pressable>
  )
}
