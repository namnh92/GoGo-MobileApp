import { LinearGradient } from 'expo-linear-gradient'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View, type ViewProps } from 'react-native'
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
import { fitIllustration, illustrationEnvelope, type IllustrationRect } from './onboarding-layout'
import { styles } from './onboarding-visual.style'

function Disc({ icon, violet = false, neutral = false, big = false }: { icon: MaterialIconName; violet?: boolean; neutral?: boolean; big?: boolean }) {
  return <View style={[styles.disc, violet && styles.violetDisc, neutral && styles.neutralDisc, big && styles.bigDisc]}>
    <MaterialIcon name={icon} size={big ? 24 : 20} color={violet ? 'status.infoInk' : neutral ? 'border.outline' : 'text.inverse'} />
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
      <LinearGradient colors={[theme.overlay.clear, theme.overlay.gradientLight, theme.overlay.gradientStrong]} style={styles.photoFill} />
      <View style={styles.bubble}>
        <FrostedMaterial kind="bubble" />
        <Text variant="introCaption">{String.fromCodePoint(0x1F914)}</Text>
        <Text variant="introCaptionMedium" color="text.secondary">{t('onboarding.slide1.bubble')}</Text>
      </View>
      <View style={styles.suggestion}>
        <FrostedMaterial />
        <View style={styles.suggestionDisc}><MaterialIcon name="bolt" size={18} color="accent.onAccent" /></View>
        <View style={styles.fill}>
          <Text variant="introLabel" color="text.primary">{t('onboarding.art.debatePlace')}</Text>
          <Text variant="introCaption" color="accent.primary">{t('onboarding.art.quick')}</Text>
        </View>
        <MaterialIcon name="checkCircle" size={20} color="status.successText" />
      </View>
    </View>
    <View style={styles.comparison}>
      <View style={styles.before}>
        <MaterialIcon name="timerOff" size={18} color="border.outline" />
        <View style={styles.fill}><Text variant="introCaption" color="text.supporting">{t('onboarding.art.before')}</Text><Text variant="introSmall" color="text.primary">{t('onboarding.art.chat')}</Text></View>
      </View>
      <MaterialIcon name="arrowRight" size={16} color="border.outline" />
      <View style={styles.after}>
        <MaterialIcon name="verified" size={18} color="status.successText" />
        <View style={styles.fill}><Text variant="introCaption" color="status.successText">{t('onboarding.art.withGoGo')}</Text><Text variant="introSmall" color="text.primary">{t('onboarding.art.oneTouch')}</Text></View>
      </View>
    </View>
  </Card>
}

function GhostCard({ right = false, onLayout }: { right?: boolean; onLayout?: ViewProps['onLayout'] }) {
  const { t } = useTranslation()
  return <Card appearance="stitch" onLayout={onLayout} style={[styles.ghost, right ? styles.ghostRight : styles.ghostLeft]}>
    <View style={styles.between}>
      <View style={[styles.row, styles.ghostIdentity]}>
        <View style={[styles.avatar, right && styles.avatarWarm]}><Text variant="introCaption" color="status.infoInk">{t(right ? 'onboarding.art.mq' : 'onboarding.art.tt')}</Text></View>
        <Text variant="introCaption" color="text.supporting" style={styles.swipeLabel}>{t(right ? 'onboarding.art.quan' : 'onboarding.art.trang')}</Text>
      </View>
      <MaterialIcon name="heart" size={18} color={right ? 'accent.primary' : 'status.successText'} />
    </View>
    <View style={styles.ghostPhoto}><RemoteImage source={artwork.swipe[right ? 1 : 0]} style={styles.photoFill} illustration />
      <View style={styles.rating}><Text variant="illustrationBadge" color="text.primary">{t(right ? 'onboarding.art.rating49' : 'onboarding.art.rating48')}</Text></View>
    </View>
    <Text variant="introSmall" color="text.primary">{t(right ? 'onboarding.art.oven' : 'onboarding.art.mua')}</Text>
    <Text variant="introCaption" color="text.supporting">{t(right ? 'onboarding.art.thaoDien' : 'onboarding.art.district3')}</Text>
  </Card>
}

type SwipeCard = 'left' | 'right' | 'main'
function Swipe({ bounds, measure }: {
  bounds: ReturnType<typeof illustrationEnvelope>
  measure: (card: SwipeCard) => ViewProps['onLayout']
}) {
  const { t } = useTranslation()
  return <View style={[styles.stack, { width: bounds.width, height: bounds.height }]}>
    <View style={[styles.stackStage, { left: -bounds.x, top: -bounds.y }]}>
    <AmbientGlow variant="swipe" />
    <GhostCard onLayout={measure('left')} /><GhostCard right onLayout={measure('right')} />
    <Card appearance="stitch" onLayout={measure('main')} style={styles.mainCard}>
      <View style={[styles.between, styles.swipeHeader]}>
        <Badge appearance="stitchNeutral" icon="lock" label={t('onboarding.slide2.private')} />
        <View style={[styles.row, styles.swipeHint]}><MaterialIcon name="touch" size={16} color="accent.primary" /><Text variant="introCaption" color="accent.primary" style={styles.swipeLabel}>{t('onboarding.slide2.swipe')}</Text></View>
      </View>
      <View style={styles.swipePhoto}><RemoteImage source={artwork.swipe[2]} style={styles.photoFill} illustration />
        <Badge appearance="stitchGreen" icon="verified" label={t('onboarding.art.suggested')} style={styles.photoBadge} />
        <Badge appearance="stitchWhite" label={t('onboarding.art.price')} style={styles.price} />
      </View>
      <Text variant="introHeading" color="text.primary">{t('onboarding.art.workshop')}</Text>
      <Text variant="introCaption" color="text.supporting" style={styles.placeMeta}>{t('onboarding.art.district1')}</Text>
      <View style={styles.swipeActions}><Disc icon="close" neutral /><Disc icon="bookmark" violet /><Disc icon="heart" big /></View>
    </Card>
    </View>
  </View>
}

function Stop({ second = false }: { second?: boolean }) {
  const { t } = useTranslation()
  return <Card appearance="stitchLow" style={styles.stop}>
    <View style={styles.thumb}>
      <RemoteImage source={artwork.plan[second ? 1 : 0]} style={styles.photoFill} illustration />
      <View style={[styles.index, second && styles.secondIndex]}><Text variant="introCaption" color="text.inverse">{t(second ? 'onboarding.art.two' : 'onboarding.art.one')}</Text></View>
    </View>
    <View style={styles.fill}>
      <View style={styles.stopHeading}>
        <Text variant="introSmall" color="text.primary" style={styles.stopTitle}>{t(second ? 'onboarding.art.stop2' : 'onboarding.art.stop1')}</Text>
        <View style={styles.row}>{!second && <MaterialIcon name="checkCircle" size={13} color="status.successText" />}<Text variant="introCaption" color={second ? 'status.infoText' : 'status.successText'}>{t(second ? 'onboarding.art.live' : 'onboarding.art.table')}</Text></View>
      </View>
      <Text variant="introCaption" color="text.secondary" style={styles.stopDescription}>{t(second ? 'onboarding.art.stop2Body' : 'onboarding.art.stop1Body')}</Text>
      <View style={styles.metaRow}><Badge appearance="stitchWhite" label={t(second ? 'onboarding.art.gogo49' : 'onboarding.art.gogo48')} /><Text variant="introCaption" color="text.secondary">{t(second ? 'onboarding.art.hours' : 'onboarding.art.q1')}</Text></View>
    </View>
  </Card>
}

function Plan() {
  const { t } = useTranslation()
  return <Card appearance="stitch" style={styles.plan}>
    <AmbientGlow variant="plan" />
    <View style={styles.planHeader}>
      <View style={styles.planHeart}><MaterialIcon name="heart" size={16} color="text.inverse" /></View>
      <View style={styles.fill}>
        <Text variant="introSmall" color="text.primary">{t('onboarding.slide3.plan')}</Text>
        <Text variant="introCaption" color="text.secondary">{t('onboarding.art.match')}</Text>
      </View>
      <Badge appearance="stitchNeutral" icon="clock" label={t('onboarding.art.duration')} />
    </View>
    <Stop />
    <View style={styles.link}>
      <View style={styles.connectorBox}><View style={styles.connector}><PulseDot /></View></View>
      <View style={styles.walk}><MaterialIcon name="walk" size={14} color="text.secondary" /><Text variant="introCaption" color="text.secondary" style={styles.fill}>{t('onboarding.art.walk')}</Text></View>
    </View>
    <Stop second />
    <View style={styles.planFooter}>
      <View style={styles.weather}><MaterialIcon name="sparkle" size={15} color="accent.primary" /><Text variant="introCaption" color="accent.primary" style={styles.fill}>{t('onboarding.art.weather')}</Text></View>
      <Text variant="introLabel" color="text.primary">{t('onboarding.art.saved')}</Text>
    </View>
  </Card>
}

/** The art has its own coordinate space; the entire drawing scales, never stretches or clips. */
type VisualProps = { slide: number; remainingArtHeight?: number; viewport?: { width: number; height: number }; onNaturalSize?: (size: { width: number; height: number }) => void }
export function OnboardingVisual(props: VisualProps) {
  const window = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { i18n } = useTranslation()
  // Re-measure at the unscaled design widths after a layout/content change.
  // A slide return must never reuse measurements from its previous mount.
  return <FittedOnboardingVisual key={`${props.slide}:${window.width}:${window.height}:${insets.top}:${insets.bottom}:${insets.left}:${insets.right}:${props.viewport?.width}:${props.viewport?.height}:${i18n.resolvedLanguage}`} {...props} window={window} />
}

function FittedOnboardingVisual({ slide, window, viewport = window, remainingArtHeight, onNaturalSize }: VisualProps & { window: ReturnType<typeof useWindowDimensions> }) {
  const insets = useSafeAreaInsets()
  const active = useRef(true)
  useLayoutEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const [heights, setHeights] = useState<Record<number, number>>({})
  const [rectangles, setRectangles] = useState<Partial<Record<SwipeCard, IllustrationRect>>>({})
  const bounds = illustrationEnvelope(rectangles.left && rectangles.right && rectangles.main ? Object.values(rectangles) : [])
  const height = slide === 1 ? bounds.height : heights[slide] ?? (slide === 0 ? 320 : 400)
  const width = slide === 1 ? bounds.width : 350
  const fit = fitIllustration(viewport.width - insets.left - insets.right, viewport.height, insets.top, insets.bottom, height, width, remainingArtHeight)
  const measured = slide === 1 ? !!(rectangles.left && rectangles.right && rectangles.main) : heights[slide] !== undefined
  useLayoutEffect(() => { if (measured) onNaturalSize?.({ width, height }) }, [measured, width, height, onNaturalSize])
  const measure = (card: SwipeCard): ViewProps['onLayout'] => event => {
    const rect = event.nativeEvent.layout
    if (!active.current || rect.width <= 0 || rect.height <= 0) return
    setRectangles(previous => {
      const old = previous[card]
      if (old && old.x === rect.x && old.y === rect.y && old.width === rect.width && old.height === rect.height) return previous
      return { ...previous, [card]: { ...rect, rotation: card === 'left' ? -8 : card === 'right' ? 9 : 0 } }
    })
  }
  return <View testID="onboarding-visual" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.visual, { width: fit.width, height: fit.height }]}>
    <View onLayout={event => { const h = event.nativeEvent.layout.height; if (active.current && slide !== 1 && h > 0 && heights[slide] !== h) setHeights(previous => ({ ...previous, [slide]: h })) }} style={[styles.art, { width, transform: [{ scale: fit.scale }] }]}>
      {slide === 0 ? <Debate /> : slide === 1 ? <Swipe bounds={bounds} measure={measure} /> : <Plan />}
    </View>
  </View>
}
