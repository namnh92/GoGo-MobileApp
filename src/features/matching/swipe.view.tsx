import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { swipeCards, unsplashUrl } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { usePriceFormatter } from '@/shared/pricing'
import { Atmosphere, BackHeader, RemoteImage, TagChip, glassStyles } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './swipe.style'

const { brand } = colors

const SWIPE_GOAL = 5
const SWIPE_THRESHOLD = 80

type SwipeChoice = 'like' | 'dislike' | 'maybe'

export default function SwipeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>()
  const { stopPrice } = usePriceFormatter()
  const [cardIndex, setCardIndex] = useState(0)
  const [swipeCount, setSwipeCount] = useState(0)
  // Animated values live in state (created once) so render never reads a ref.
  const [position] = useState(() => new Animated.ValueXY())
  // Mutated only inside event/animation callbacks, never during render.
  const progressRef = useRef({ index: 0, count: 0 })

  const card = swipeCards[cardIndex % swipeCards.length]

  const rotate = position.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-16deg', '0deg', '16deg'] })
  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' })
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  const maybeOpacity = position.y.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) flyOut('like')
        else if (gesture.dx < -SWIPE_THRESHOLD) flyOut('dislike')
        else if (gesture.dy < -SWIPE_THRESHOLD) flyOut('maybe')
        else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
      },
    }),
  )

  function advance(choice: SwipeChoice) {
    const current = swipeCards[progressRef.current.index % swipeCards.length]
    if (choice === 'like') track('swipe_like', { card: current.title })
    if (choice === 'dislike') track('swipe_dislike', { card: current.title })
    progressRef.current.index += 1
    progressRef.current.count += 1
    setSwipeCount(progressRef.current.count)
    setCardIndex(progressRef.current.index)
    position.setValue({ x: 0, y: 0 })
    if (progressRef.current.count >= SWIPE_GOAL) {
      setTimeout(() => router.replace(`/room/${inviteCode}/waiting`), 300)
    }
  }

  function flyOut(choice: SwipeChoice) {
    const target = choice === 'like' ? { x: 400, y: 0 } : choice === 'dislike' ? { x: -400, y: 0 } : { x: 0, y: -400 }
    Animated.timing(position, { toValue: target, duration: 200, useNativeDriver: false }).start(() => advance(choice))
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader
          onBack={() => router.back()}
          right={<Text style={styles.counter}>{Math.min(swipeCount + 1, SWIPE_GOAL)} / {SWIPE_GOAL}</Text>}
        />
      </View>
      <View style={{ alignItems: 'center', marginTop: -spacing[2], marginBottom: spacing[2] }}>
        <Text style={styles.header}>{t('swipe.header')}</Text>
        <Text style={styles.subheader}>{t('swipe.subheader')}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(swipeCount / SWIPE_GOAL) * 100}%` }]} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing[5], paddingTop: spacing[2] }}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.card, glassStyles.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
        >
          <View style={{ height: '58%' }}>
            <RemoteImage uri={unsplashUrl(card.img, 600, 500)} style={StyleSheet.absoluteFill} />
            <View style={styles.imageScrim} />
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryLabel}>{card.category}</Text>
            </View>
            <Animated.View style={[styles.overlay, { left: 20, backgroundColor: brand.mint, opacity: likeOpacity, transform: [{ rotate: '-15deg' }] }]}>
              <Text style={styles.overlayLabel}>{t('swipe.like')}</Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, { right: 20, backgroundColor: brand.coral, opacity: nopeOpacity, transform: [{ rotate: '15deg' }] }]}>
              <Text style={styles.overlayLabel}>{t('swipe.pass')}</Text>
            </Animated.View>
            <Animated.View style={[styles.overlay, { alignSelf: 'center', backgroundColor: brand.lavender, opacity: maybeOpacity }]}>
              <Text style={styles.overlayLabel}>{t('swipe.maybe')}</Text>
            </Animated.View>
            <View style={styles.areaRow}>
              <Text style={styles.areaLabel}>📍 {card.area}</Text>
            </View>
          </View>
          <View style={{ padding: spacing[4] }}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <View style={styles.tagRow}>
              {card.tags.map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
              <TagChip label={stopPrice(card.priceK)} color="coral" />
            </View>
            <Text style={styles.desc} numberOfLines={2}>{card.desc}</Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <Pressable onPress={() => flyOut('dislike')} accessibilityLabel={t('swipe.passLabel')} style={[styles.actionBtn, glassStyles.card]}>
              <Text style={{ fontSize: 24 }}>✕</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.passLabel')}</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable onPress={() => flyOut('maybe')} accessibilityLabel={t('swipe.maybeLabel')} style={[styles.actionBtn, { width: 48, height: 48, backgroundColor: brand.lavenderSoft }]}>
              <Text style={{ fontSize: 20 }}>🤔</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.maybeLabel')}</Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable onPress={() => flyOut('like')} accessibilityLabel={t('swipe.likeLabel')} style={[styles.actionBtn, { backgroundColor: brand.coral }]}>
              <Text style={{ fontSize: 24 }}>❤️</Text>
            </Pressable>
            <Text style={styles.actionCaption}>{t('swipe.likeLabel')}</Text>
          </View>
        </View>
      </View>
    </Atmosphere>
  )
}
