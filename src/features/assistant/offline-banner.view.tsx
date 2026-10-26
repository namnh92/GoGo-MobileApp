import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'

import { styles } from './offline-banner.style'

/** Design system `OfflineBanner`: under the header for as long as the device is offline. */
export function OfflineBanner() {
  const { t } = useTranslation()
  return (
    <View testID="assistant-offline-banner" accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.banner}>
      <Icon name="wifiOff" size={16} color="status.dangerText" />
      <Text variant="label" color="status.dangerText" style={styles.text}>{t('assistant.offline.banner')}</Text>
    </View>
  )
}
