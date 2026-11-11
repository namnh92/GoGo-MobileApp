import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './location-row.style'

/** One area entry for Home, Discovery and the create wizard. */
export function LocationRow({ label, onPress, testID }: { label: string | null; onPress: () => void; testID?: string }) {
  const { t } = useTranslation()
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t('home.chooseArea')} onPress={onPress} style={styles.row}>
    <MaterialIcon name="location" size={15} color="accent.text" />
    <Text variant="introCaptionMedium" color="text.secondary" style={styles.label}>{label ?? t('home.chooseArea')}</Text>
    <MaterialIcon name="expandMore" size={16} color="text.secondary" />
  </Pressable>
}
