import { useRouter } from 'expo-router'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MessageKey } from '@/shared/i18n/types'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { onboardingPermissionStore } from '@/shared/notifications/onboarding-permission-store'
import { markOnboardingComplete } from '@/shared/storage/onboarding'
import { Atmosphere, GhostBtn, IconBtn, PrimaryBtn, ProgressDots } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { OnboardingVisual } from './onboarding-visual.view'
import { styles } from './onboarding.style'
import { fitIllustration, onboardingArrangement, onboardingSpacing } from './onboarding-layout'

const slides = [
  { titleKey: 'onboarding.slide1.title', bodyKey: 'onboarding.slide1.body', dots: 'debate' },
  { titleKey: 'onboarding.slide2.title', bodyKey: 'onboarding.slide2.body', dots: 'swipe' },
  { titleKey: 'onboarding.slide3.title', bodyKey: 'onboarding.slide3.body', dots: 'plan' },
] as const satisfies readonly { titleKey: MessageKey; bodyKey: MessageKey; dots: 'debate' | 'swipe' | 'plan' }[]

export default function OnboardingScreen() {
  const { i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const [{ slide, visit }, setPosition] = useState({ slide: 0, visit: 0 })
  const [finishing, setFinishing] = useState(false)
  // This owner survives keyed bodies; a stale callback cannot navigate or finish.
  const navigation = useRef({ visit: 0, finishing: false, alive: true })
  useLayoutEffect(() => {
    const owner = navigation.current
    owner.alive = true
    return () => { owner.alive = false }
  }, [])
  const environment = `${window.width}:${window.height}:${window.fontScale}:${insets.top}:${insets.bottom}:${insets.left}:${insets.right}:${i18n.resolvedLanguage}`
  const [viewport, setViewport] = useState<{ environment: string; width: number; height: number }>()
  const measured = viewport?.environment === environment
  const size = measured ? viewport : window
  const generation = useMemo(() => ({ environment, width: size.width, height: size.height }), [environment, size.width, size.height])
  const activeEnvironment = useRef<typeof generation | null>(generation)
  useLayoutEffect(() => {
    activeEnvironment.current = generation
    return () => { activeEnvironment.current = null }
  }, [generation])

  function currentVisit() {
    return navigation.current.alive && !navigation.current.finishing && navigation.current.visit === visit && activeEnvironment.current === generation
  }
  function navigate(delta: number) {
    if (!currentVisit()) return
    const next = Math.max(0, Math.min(slides.length - 1, slide + delta))
    if (next === slide) return
    navigation.current.visit++
    setPosition({ slide: next, visit: visit + 1 })
  }
  async function finish() {
    if (!currentVisit()) return
    navigation.current.finishing = true
    setFinishing(true)
    await markOnboardingComplete()
    await pushPermission.request().catch(() => undefined)
    router.replace('/(tabs)')
  }

  async function start() {
    if (!currentVisit()) return
    navigation.current.finishing = true
    setFinishing(true)
    await onboardingPermissionStore.defer()
    await markOnboardingComplete()
    router.replace('/auth/sign-in')
  }

  return (
    <Atmosphere redesign>
      <View testID="onboarding-viewport" style={styles.fill} onLayout={event => {
        if (activeEnvironment.current !== generation) return
        const { width, height } = event.nativeEvent.layout
        if (width <= 0 || height <= 0) return
        setViewport(previous => previous?.environment === environment && previous.width === width && previous.height === height ? previous : { environment, width, height })
      }}>
        <OnboardingBody key={`${slide}:${environment}:${size.width}:${size.height}`} slide={slide} navigate={navigate} finishing={finishing} finish={finish} start={start} viewport={size} viewportMeasured={measured} fontScale={window.fontScale} insets={insets} />
      </View>
    </Atmosphere>
  )
}

type Block = 'header' | 'narrative' | 'dots' | 'actions'
function OnboardingBody({ slide, navigate, finishing, finish, start, viewport, viewportMeasured, fontScale, insets }: {
  slide: number; navigate: (delta: number) => void; finishing: boolean; finish: () => Promise<void>; start: () => Promise<void>
  viewport: { width: number; height: number }; viewportMeasured: boolean; fontScale: number; insets: ReturnType<typeof useSafeAreaInsets>
}) {
  const { t } = useTranslation()
  const current = slides[slide]
  const isLast = slide === 2
  const scroll = useRef<ScrollView>(null)
  const active = useRef(true)
  const [blocks, setBlocks] = useState<Partial<Record<Block, number>>>({})
  const [art, setArt] = useState<{ width: number; height: number }>()
  useLayoutEffect(() => {
    active.current = true
    // This body remounts on Next/Back and any geometry/language change. Native
    // scroll state and all intrinsic measurements belong to that mount only.
    scroll.current?.scrollTo({ y: 0, animated: false })
    return () => { active.current = false }
  }, [])
  const measure = (block: Block) => (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (!active.current || height <= 0 || Math.abs(width - (viewport.width - insets.left - insets.right - 40)) > 0.5) return
    setBlocks(previous => previous[block] === height ? previous : { ...previous, [block]: height })
  }
  const measureArt = useCallback((size: { width: number; height: number }) => {
    if (active.current) setArt(previous => previous?.width === size.width && previous.height === size.height ? previous : size)
  }, [])
  const gaps = onboardingSpacing(slide)
  const margins = gaps.header * 2 + gaps.visualTop + gaps.visualBottom + gaps.narrative + gaps.dotsTop + gaps.dotsBottom + gaps.actions + gaps.bottom
  const nonArt = Object.values(blocks).reduce((sum, height) => sum + height, 0) + margins + insets.top + insets.bottom
  const fit = art && fitIllustration(viewport.width - insets.left - insets.right, viewport.height, insets.top, insets.bottom, art.height, art.width)
  const complete = viewportMeasured && !!art && (['header', 'narrative', 'dots', 'actions'] as const).every(block => blocks[block] !== undefined)
  const arrangement = onboardingArrangement(viewport.height, nonArt, fit?.height ?? 0, fontScale, complete)
  // The former final-slide space-between had four intervals. Distribute only
  // spare space, without measuring stretched blocks or feeding back fitted art.
  const distributedGap = isLast ? arrangement.spare / 4 : 0
  const wholeScreenScroll = (blocks.actions ?? 0) + gaps.actions + gaps.bottom + insets.top + insets.bottom >= viewport.height
  const nativeScroll = useMemo(() => Gesture.Native(), [])
  const pan = useMemo(() => Gesture.Pan().withTestId('onboarding-swipe')
    .maxPointers(1).activeOffsetX([-20, 20]).failOffsetY([-12, 12])
    .simultaneousWithExternalGesture(nativeScroll).runOnJS(true).enabled(!finishing)
    .onEnd((event, success) => {
      if (!success || Math.abs(event.translationX) < 48 || Math.abs(event.translationX) <= 1.5 * Math.abs(event.translationY)) return
      navigate(event.translationX < 0 ? 1 : -1)
    }), [finishing, nativeScroll, navigate])
  const narrative = <>
    <View testID="onboarding-header" onLayout={measure('header')} style={[styles.header, slide > 0 && styles.headerSpaced]}>
      {slide > 0 && <IconBtn accessibilityLabel={t('common.back')} disabled={finishing} onPress={() => navigate(-1)} style={styles.back}>
        <MaterialIcon name="arrowBack" size={24} />
      </IconBtn>}
      <View style={styles.headerSpace} />
      <GhostBtn variant={slide === 1 ? 'stitchSkipPill' : 'stitchSkip'} disabled={finishing} label={t('onboarding.skip')} onPress={finish} />
    </View>
    <View style={[styles.visual, isLast && styles.lastVisual]}>
      <OnboardingVisual slide={slide} viewport={viewport} remainingArtHeight={arrangement.artBudget} onNaturalSize={measureArt} />
    </View>
    {isLast && <View testID="onboarding-dots" onLayout={measure('dots')} style={styles.lastDots}><ProgressDots total={3} current={slide} variant={current.dots} /></View>}
    <View testID="onboarding-narrative" onLayout={measure('narrative')} style={[styles.narrative, slide === 1 && styles.swipeNarrative]}>
      <Text variant={slide === 1 ? 'introCompact' : 'introTitle'} color={slide === 1 ? 'redesign.mutedTitle' : 'redesign.ink'} style={styles.title}>{t(current.titleKey)}</Text>
      <Text variant={slide > 0 ? 'introRelaxed' : 'introBody'} color={slide === 1 ? 'redesign.mutedBody' : 'redesign.secondary'} style={styles.body}>{t(current.bodyKey)}</Text>
    </View>
    {!isLast && <View testID="onboarding-dots" onLayout={measure('dots')} style={[styles.dots, slide === 1 && styles.swipeDots]}><ProgressDots total={3} current={slide} variant={current.dots} /></View>}
  </>
  const actions = <View testID="onboarding-actions" onLayout={measure('actions')} style={[styles.actions, isLast && styles.lastActions, { marginTop: gaps.actions + distributedGap }]}>
    <PrimaryBtn variant={slide === 1 ? 'stitchSubtle' : 'stitch'} loading={finishing} label={t(isLast ? 'onboarding.start' : 'onboarding.next')} icon={isLast ? undefined : 'arrowRight'} onPress={() => { if (isLast) void start(); else navigate(1) }} />
    {isLast && <GhostBtn variant="stitchGuest" disabled={finishing} label={t('onboarding.guest')} onPress={finish} />}
  </View>
  const padding = { paddingTop: insets.top, paddingBottom: insets.bottom + gaps.bottom, paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right }
  if (wholeScreenScroll) return <GestureDetector gesture={pan}>
    <View style={styles.fill}>
      <GestureDetector gesture={nativeScroll}>
        <ScrollView ref={scroll} testID="onboarding-whole" contentContainerStyle={padding} contentOffset={{ x: 0, y: 0 }}>{narrative}{actions}</ScrollView>
      </GestureDetector>
    </View>
  </GestureDetector>
  return <View style={[styles.content, padding]}>
    <GestureDetector gesture={pan}>
      <View style={styles.upperRegion}>
        <GestureDetector gesture={nativeScroll}>
          <ScrollView ref={scroll} testID="onboarding-upper" style={styles.upper} contentContainerStyle={{ gap: distributedGap }} scrollEnabled={arrangement.footer} contentOffset={{ x: 0, y: 0 }}>{narrative}</ScrollView>
        </GestureDetector>
      </View>
    </GestureDetector>
    {actions}
  </View>
}
