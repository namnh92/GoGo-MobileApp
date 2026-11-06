import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import { FrostedMaterial } from '@/shared/ui/frosted-material.view'
import { PulseDot } from '@/shared/ui/pulse-dot.view'
import { RemoteImage } from '@/shared/ui/primitives'
import { AmbientGlow } from '@/shared/ui/ambient-glow.view'
import { Badge } from '@/shared/ui/badge.view'
import { Card } from '@/shared/ui/card.view'
import { MaterialIcon, type MaterialIconName } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { artwork } from './onboarding-artwork'
import { fitIllustration } from './onboarding-layout'
import { styles } from './onboarding-visual.style'

function Disc({ icon, violet = false, neutral = false, big = false }: { icon: MaterialIconName; violet?: boolean; neutral?: boolean; big?: boolean }) {
  return <View style={[styles.disc, violet && styles.violetDisc, neutral && styles.neutralDisc, big && styles.bigDisc]}>
    <MaterialIcon name={icon} size={big ? 24 : 20} color={violet ? 'redesign.violetInk' : neutral ? 'redesign.outline' : 'redesign.white'} />
  </View>
}

/** D2: static illustration, not a PlaceCard or a backend claim. */
function Debate() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return <Card appearance="stitch" style={styles.debate}>
    <AmbientGlow variant="debate" />
    <View style={styles.debatePhoto}>
      <RemoteImage source={artwork.debate[0]} style={styles.photoFill} illustration />
      <LinearGradient colors={[theme.redesign.clear, theme.redesign.scrimMiddle, theme.redesign.scrimStart]} style={styles.photoFill} />
      <View style={styles.bubble}>
        <FrostedMaterial kind="bubble" />
        <Text variant="introCaption">{String.fromCodePoint(0x1F914)}</Text>
        <Text variant="introCaptionMedium" color="redesign.secondary">{t('onboarding.slide1.bubble')}</Text>
      </View>
      <View style={styles.suggestion}>
        <FrostedMaterial />
        <View style={styles.suggestionDisc}><MaterialIcon name="bolt" size={18} color="redesign.white" /></View>
        <View style={styles.fill}>
          <Text variant="introLabel" color="redesign.ink">{t('onboarding.art.debatePlace')}</Text>
          <Text variant="introCaption" color="accent.primary">{t('onboarding.art.quick')}</Text>
        </View>
        <MaterialIcon name="checkCircle" size={20} color="redesign.greenText" />
      </View>
    </View>
    <View style={styles.comparison}>
      <View style={styles.before}>
        <MaterialIcon name="timerOff" size={18} color="redesign.outline" />
        <View style={styles.fill}><Text variant="introCaption" color="redesign.outline">{t('onboarding.art.before')}</Text><Text variant="introSmall" color="redesign.ink">{t('onboarding.art.chat')}</Text></View>
      </View>
      <MaterialIcon name="arrowRight" size={16} color="redesign.outline" />
      <View style={styles.after}>
        <MaterialIcon name="verified" size={18} color="redesign.greenText" />
        <View style={styles.fill}><Text variant="introCaption" color="redesign.greenText">{t('onboarding.art.withGoGo')}</Text><Text variant="introSmall" color="redesign.ink">{t('onboarding.art.oneTouch')}</Text></View>
      </View>
    </View>
  </Card>
}

function GhostCard({ right = false }: { right?: boolean }) {
  const { t } = useTranslation()
  return <Card appearance="stitch" style={[styles.ghost, right ? styles.ghostRight : styles.ghostLeft]}>
    <View style={styles.between}>
      <View style={styles.row}>
        <View style={[styles.avatar, right && styles.avatarWarm]}><Text variant="introCaption" color="redesign.violetInk">{t(right ? 'onboarding.art.mq' : 'onboarding.art.tt')}</Text></View>
        <Text variant="introCaption" color="redesign.outline">{t(right ? 'onboarding.art.quan' : 'onboarding.art.trang')}</Text>
      </View>
      <MaterialIcon name="heart" size={18} color={right ? 'accent.primary' : 'redesign.greenText'} />
    </View>
    <View style={styles.ghostPhoto}><RemoteImage source={artwork.swipe[right ? 1 : 0]} style={styles.photoFill} illustration />
      <View style={styles.rating}><Text variant="illustrationBadge" color="redesign.ink">{t(right ? 'onboarding.art.rating49' : 'onboarding.art.rating48')}</Text></View>
    </View>
    <Text variant="introSmall" color="redesign.ink">{t(right ? 'onboarding.art.oven' : 'onboarding.art.mua')}</Text>
    <Text variant="introCaption" color="redesign.outline">{t(right ? 'onboarding.art.thaoDien' : 'onboarding.art.district3')}</Text>
  </Card>
}

function Swipe() {
  const { t } = useTranslation()
  return <View style={styles.stack}>
    <AmbientGlow variant="swipe" />
    <GhostCard /><GhostCard right />
    <Card appearance="stitch" style={styles.mainCard}>
      <View style={styles.between}>
        <Badge appearance="stitchNeutral" icon="lock" label={t('onboarding.slide2.private')} />
        <View style={styles.row}><MaterialIcon name="touch" size={16} color="accent.primary" /><Text variant="introCaption" color="accent.primary">{t('onboarding.slide2.swipe')}</Text></View>
      </View>
      <View style={styles.swipePhoto}><RemoteImage source={artwork.swipe[2]} style={styles.photoFill} illustration />
        <Badge appearance="stitchGreen" icon="verified" label={t('onboarding.art.suggested')} style={styles.photoBadge} />
        <Badge appearance="stitchWhite" label={t('onboarding.art.price')} style={styles.price} />
      </View>
      <Text variant="introHeading" color="redesign.ink">{t('onboarding.art.workshop')}</Text>
      <Text variant="introCaption" color="redesign.outline" style={styles.placeMeta}>{t('onboarding.art.district1')}</Text>
      <View style={styles.swipeActions}><Disc icon="close" neutral /><Disc icon="bookmark" violet /><Disc icon="heart" big /></View>
    </Card>
  </View>
}

function Stop({ second = false }: { second?: boolean }) {
  const { t } = useTranslation()
  return <Card appearance="stitchLow" style={styles.stop}>
    <View style={styles.thumb}>
      <RemoteImage source={artwork.plan[second ? 1 : 0]} style={styles.photoFill} illustration />
      <View style={[styles.index, second && styles.secondIndex]}><Text variant="introCaption" color="redesign.white">{t(second ? 'onboarding.art.two' : 'onboarding.art.one')}</Text></View>
    </View>
    <View style={styles.fill}>
      <View style={styles.stopHeading}>
        <Text variant="introSmall" color="redesign.ink" style={styles.stopTitle}>{t(second ? 'onboarding.art.stop2' : 'onboarding.art.stop1')}</Text>
        <View style={styles.row}>{!second && <MaterialIcon name="checkCircle" size={13} color="redesign.greenText" />}<Text variant="introCaption" color={second ? 'redesign.violetText' : 'redesign.greenText'}>{t(second ? 'onboarding.art.live' : 'onboarding.art.table')}</Text></View>
      </View>
      <Text variant="introCaption" color="redesign.secondary" style={styles.stopDescription}>{t(second ? 'onboarding.art.stop2Body' : 'onboarding.art.stop1Body')}</Text>
      <View style={styles.metaRow}><Badge appearance="stitchWhite" label={t(second ? 'onboarding.art.gogo49' : 'onboarding.art.gogo48')} /><Text variant="introCaption" color="redesign.secondary">{t(second ? 'onboarding.art.hours' : 'onboarding.art.q1')}</Text></View>
    </View>
  </Card>
}

function Plan() {
  const { t } = useTranslation()
  return <Card appearance="stitch" style={styles.plan}>
    <AmbientGlow variant="plan" />
    <View style={styles.planHeader}>
      <View style={styles.planHeart}><MaterialIcon name="heart" size={16} color="redesign.white" /></View>
      <View style={styles.fill}>
        <Text variant="introSmall" color="redesign.ink">{t('onboarding.slide3.plan')}</Text>
        <Text variant="introCaption" color="redesign.secondary">{t('onboarding.art.match')}</Text>
      </View>
      <Badge appearance="stitchNeutral" icon="clock" label={t('onboarding.art.duration')} />
    </View>
    <Stop />
    <View style={styles.link}>
      <View style={styles.connectorBox}><View style={styles.connector}><PulseDot /></View></View>
      <View style={styles.walk}><MaterialIcon name="walk" size={14} color="redesign.secondary" /><Text variant="introCaption" color="redesign.secondary" style={styles.fill}>{t('onboarding.art.walk')}</Text></View>
    </View>
    <Stop second />
    <View style={styles.planFooter}>
      <View style={styles.weather}><MaterialIcon name="sparkle" size={15} color="accent.primary" /><Text variant="introCaption" color="accent.primary" style={styles.fill}>{t('onboarding.art.weather')}</Text></View>
      <Text variant="introLabel" color="redesign.ink">{t('onboarding.art.saved')}</Text>
    </View>
  </Card>
}

/** The art has its own coordinate space; the entire drawing scales, never stretches or clips. */
export function OnboardingVisual({ slide }: { slide: number }) {
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [heights, setHeights] = useState<Record<number, number>>({})
  const height = heights[slide] ?? (slide === 0 ? 320 : slide === 1 ? 340 : 400)
  const fit = fitIllustration(window.width, window.height, insets.top, insets.bottom, height)
  return <View testID="onboarding-visual" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.visual, { width: fit.width, height: fit.height }]}>
    <View onLayout={event => { const h = event.nativeEvent.layout.height; if (h > 0 && heights[slide] !== h) setHeights(previous => ({ ...previous, [slide]: h })) }} style={[styles.art, { transform: [{ scale: fit.scale }] }]}>
      {slide === 0 ? <Debate /> : slide === 1 ? <Swipe /> : <Plan />}
    </View>
  </View>
}
