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
        <Text variant="introLabel" color="redesign.ink" style={styles.flex}>{t('placeImport.guideTitle')}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void openWebsite('https://www.google.com/maps').then(ok => { if (!ok) onLinkFailed() }) }} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
          <Text variant="introLabel" color="redesign.primaryText">{t('placeImport.openMaps')}</Text>
          <MaterialIcon name="arrowRight" size={14} color="redesign.primaryText" />
        </Pressable>
      </View>
      {[1, 2, 3].map(step => <View key={step} style={styles.guideStep}>
        <View style={styles.stepDisc}><Text variant="introLabel" color="redesign.ink">{step}</Text></View>
        <Text variant="introSmall" color="redesign.secondary" style={styles.flex}>{t(`placeImport.guideStep${step}`)}</Text>
      </View>)}
    </View>
    <View style={styles.benefitsCard}>
      <Text variant="introLabel" color="redesign.secondary">{t('placeImport.benefitsTitle')}</Text>
      {(['bolt', 'verified', 'sparkle'] as const).map((icon, index) => <View key={icon} style={styles.benefitRow}>
        <View style={[styles.benefitIcon, index === 1 && styles.connectedBadge, index === 2 && styles.rewardIcon]}><MaterialIcon name={icon} size={18} color={index === 2 ? 'redesign.greenText' : index === 1 ? 'redesign.violetText' : 'redesign.primaryText'} /></View>
        <View style={styles.flex}><Text variant="introLabel" color="redesign.ink">{t(`placeImport.benefit${index + 1}Title`)}</Text><Text variant="introSmall" color="redesign.secondary">{t(`placeImport.benefit${index + 1}Body`)}</Text></View>
      </View>)}
    </View>
  </>
}
