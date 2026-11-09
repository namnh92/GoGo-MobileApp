import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { openWebsite } from '@/shared/navigation/external-links'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { styles } from './import.style'

/** The link-taking instructions, distinct from the deferred contribution wizard. */
export function ImportGuide({ onLinkFailed }: { onLinkFailed: () => void }) {
  const { t } = useTranslation()
  return <>
    <View testID="import-link-guide" style={styles.guideCard}>
      <View style={styles.guideHeading}>
        <Text variant="introLabel" color="text.primary" style={styles.flex}>{t('placeImport.guideTitle')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void openWebsite('https://www.google.com/maps').then(ok => { if (!ok) onLinkFailed() }) }} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
          <Text variant="introLabel" color="accent.text">{t('placeImport.openMaps')}</Text>
          <MaterialIcon name="arrowRight" size={14} color="accent.text" />
        </Pressable>
      </View>
      {[1, 2, 3].map(step => <View key={step} style={styles.guideStep}>
        <View style={styles.stepDisc}><Text variant="introLabel" color="text.primary">{step}</Text></View>
        <Text variant="introSmall" color="text.secondary" style={styles.flex}>{t(`placeImport.guideStep${step}`)}</Text>
      </View>)}
    </View>
    <View style={styles.benefitsCard}>
      <Text variant="introLabel" color="text.secondary">{t('placeImport.benefitsTitle')}</Text>
      {(['bolt', 'verified', 'sparkle'] as const).map((icon, index) => <View key={icon} style={styles.benefitRow}>
        <View style={[styles.benefitIcon, index === 1 && styles.connectedBadge, index === 2 && styles.rewardIcon]}><MaterialIcon name={icon} size={18} color={index === 2 ? 'status.successText' : index === 1 ? 'status.infoText' : 'accent.text'} /></View>
        <View style={styles.flex}><Text variant="introLabel" color="text.primary">{t(`placeImport.benefit${index + 1}Title`)}</Text><Text variant="introSmall" color="text.secondary">{t(`placeImport.benefit${index + 1}Body`)}</Text></View>
      </View>)}
    </View>
  </>
}
