import { View } from 'react-native'
import { Card } from './card.view'
import { MaterialIcon } from './material-icon'
import { Text } from './text'
import { styles } from './info-banner.style'

export function InfoBanner({ title, body, footerLeft, footerRight, coffee = false }: {
  title?: string; body: string; footerLeft?: string; footerRight?: string; coffee?: boolean
}) {
  return <Card appearance={coffee ? 'stitchLow' : 'stitch'} style={[styles.card, coffee && styles.coffee]}>
    <View style={styles.row}>
      {coffee ? <View style={styles.coffeeIcon}><MaterialIcon name="coffee" size={24} color="accent.primary" /></View> : <MaterialIcon name="info" size={20} color="redesign.violetText" />}
      <View style={styles.fill}>{title && <Text variant="introLabel" color="redesign.ink">{title}</Text>}<Text variant={coffee ? 'introCaption' : 'introSmall'} color="redesign.secondary">{body}</Text></View>
    </View>
    {(footerLeft || footerRight) && <View style={styles.footer}>
      <View style={styles.footerLabel}><View style={styles.dot} /><Text variant="introCaption" color="redesign.outline" style={styles.shrink}>{footerLeft}</Text></View>
      <Text variant="introCaption" color="redesign.outline" style={styles.shrink}>{footerRight}</Text>
    </View>}
  </Card>
}
