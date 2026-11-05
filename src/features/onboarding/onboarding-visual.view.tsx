import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Card } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { styles } from './onboarding-visual.style'

/** Decorative drawing for a slide. Hidden from screen readers: the title and body carry the meaning. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const

function Bar({ long }: { long?: boolean }) {
  return <View style={[styles.bar, long ? styles.barLong : styles.barShort]} />
}

/** Slide 1: a place photo block with a speech bubble and a suggested-place row. */
function Debate() {
  const { t } = useTranslation()
  return (
    <View style={styles.frame}>
      <View style={[styles.photo, styles.photoTall]}>
        <View style={styles.bubble}>
          <Text variant="label" color="text.primary" numberOfLines={1}>{t('onboarding.slide1.bubble')}</Text>
        </View>
      </View>
      <View style={[styles.row, styles.hintRow]}>
        <View style={styles.disc}><Icon name="zap" size={16} color="accent.onAccent" /></View>
        <View style={styles.fill}><Bar long /></View>
        <Icon name="checkCircle" size={20} color="accent.primary" />
      </View>
    </View>
  )
}

/** Slide 2: a private swipe card in front of two others. */
function Swipe() {
  const { t } = useTranslation()
  return (
    <View style={[styles.frame, styles.stack]}>
      <View style={[styles.ghost, styles.ghostLeft]} />
      <View style={[styles.ghost, styles.ghostRight]} />
      <View style={styles.mainCard}>
        <View style={styles.rowBetween}>
          <View style={styles.pill}>
            <Icon name="lock" size={12} color="text.secondary" />
            <Text variant="label" color="text.secondary" numberOfLines={1}>{t('onboarding.slide2.private')}</Text>
          </View>
          <Text variant="label" color="accent.primary" numberOfLines={1}>{t('onboarding.slide2.swipe')}</Text>
        </View>
        <View style={[styles.photo, styles.photoShort]}>
          <View style={styles.bubble}>
            <Text variant="label" color="text.primary" numberOfLines={1}>{t('home.suggestedHint')}</Text>
          </View>
        </View>
        <Bar long />
        <Bar />
        <View style={styles.actions}>
          <View style={[styles.disc, styles.discSoft]}><Icon name="x" size={16} color="text.secondary" /></View>
          <View style={[styles.disc, styles.discSoft]}><Icon name="bookmark" size={16} color="text.secondary" /></View>
          <View style={[styles.disc, styles.discBig]}><Icon name="heart" size={22} color="accent.onAccent" filled /></View>
        </View>
      </View>
    </View>
  )
}

function Stop({ n }: { n: number }) {
  return (
    <View style={styles.stop}>
      <View style={styles.thumb}>
        <View style={styles.index}><Text variant="label" color="accent.onAccent">{n}</Text></View>
      </View>
      <View style={styles.fill}>
        <Bar long />
        <Bar />
      </View>
    </View>
  )
}

/** Slide 3: a two-stop plan card with a walking link between the stops. */
function Plan() {
  const { t } = useTranslation()
  return (
    <View style={styles.frame}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <View style={styles.disc}><Icon name="heart" size={16} color="accent.onAccent" filled /></View>
          <Text variant="label" color="text.primary" numberOfLines={1}>{t('onboarding.slide3.plan')}</Text>
        </View>
        <View style={styles.pill}>
          <Icon name="clock" size={12} color="text.secondary" />
          <View style={[styles.bar, styles.barTiny]} />
        </View>
      </View>
      <Stop n={1} />
      <View style={styles.link}>
        <View style={styles.linkLine} />
        <View style={styles.linkPill}>
          <Icon name="navigation" size={14} color="text.secondary" />
          <Bar long />
        </View>
      </View>
      <Stop n={2} />
    </View>
  )
}

export function OnboardingVisual({ slide }: { slide: number }) {
  return (
    <View style={styles.visual} testID="onboarding-visual" {...HIDDEN}>
      <Card padded={false}>
        {slide === 0 ? <Debate /> : slide === 1 ? <Swipe /> : <Plan />}
      </Card>
    </View>
  )
}
