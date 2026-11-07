import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type DimensionValue,
} from 'react-native'
import { TextInput } from '@/shared/ui/text-input'
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { useKeyboardVisible } from '@/shared/ui/keyboard'
import { motion, spacing } from '@/shared/ui/tokens'

import { FocusedFieldGroup } from './field-focus-group'
import { styles } from './sheet.style'

export interface SheetProps {
  swipeToClose?: boolean
  appearance?: 'default' | 'discovery'
  visible: boolean
  /** Backdrop tap, Android back, the VoiceOver escape gesture. */
  onClose: () => void
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /**
   * `content` grows with its children up to `maxHeight`; `full` is a tall
   * picker (a list with its own search field) that fills most of the screen.
   */
  size?: 'content' | 'full'
  maxHeight?: DimensionValue
  /**
   * Wraps the children in a ScrollView (the default). A sheet whose body is a
   * virtualised list passes `false` and lets the list scroll.
   */
  scroll?: boolean
  testID?: string
  /**
   * The sheet has fully left the screen: its exit slide is over and the
   * native modal is dismissed. **Open the next modal from here**, never in
   * the handler that closes this one (iOS acceptance BUG3, #378). iOS presents
   * one modal per presenter: a second RN `Modal` asked to appear while this
   * one is still up (or sliding out) is refused by UIKit, never shows, and
   * leaves an invisible window that swallows every touch until the app is
   * killed. iOS reports it through `Modal.onDismiss`; elsewhere the modal is
   * gone once it unmounts.
   */
  onClosed?: () => void
}

/** Space kept between a focused field and the top of the keyboard. */
const FOCUS_MARGIN = spacing[4]

/**
 * The one bottom sheet (GoGo-MobileApp#381). Replaces the hand-written
 * `<Modal transparent animationType="slide">` copies, which slid the backdrop
 * up with the panel, ignored reduced motion, left the backdrop unnamed and let
 * the keyboard cover their inputs.
 *
 * - Motion: the panel rises over `motion.standard` (240 ms) while the backdrop
 *   fades in. Wait for the OS preference before presenting the first frame;
 *   with `Giảm chuyển động` on it is simply there: no slide, no fade.
 * - Keyboard: a `KeyboardAvoidingView` (React Native's own — a keyboard
 *   native module needs an ADR) pads the screen by however much the keyboard
 *   overlaps it. It measures the overlap, so a platform that already resized
 *   the window gets no second lift. The focused field is then scrolled into
 *   what is left of the panel.
 * - Screen readers: the backdrop is a button named "Đóng", and the escape
 *   gesture closes the sheet.
 */
export function Sheet({ swipeToClose = false, appearance = 'default', visible, onClose, onClosed, children, header, footer, size = 'content', maxHeight = '85%', scroll = true, testID }: SheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const motionPreference = useReducedMotionPreference()
  const reduced = motionPreference ?? true
  const keyboardVisible = useKeyboardVisible()

  // Closing with motion keeps the sheet on screen for its exit slide. Derived
  // while rendering, so the frame that hides it is the one that starts the exit.
  const [shownFor, setShownFor] = useState(visible)
  const [exiting, setExiting] = useState(false)
  if (shownFor !== visible || (exiting && reduced)) {
    setShownFor(visible)
    setExiting(!visible && !reduced)
  }
  const mounted = (visible && motionPreference !== null) || exiting
  // Even an initially visible sheet must enter from below the screen.
  const progress = useSharedValue(0)
  const visibleRef = useRef(visible)
  useLayoutEffect(() => {
    visibleRef.current = visible
  }, [visible])
  const finishExit = useCallback(() => {
    if (!visibleRef.current) setExiting(false)
  }, [])

  useEffect(() => {
    if (motionPreference === null) return
    if (visible) {
      progress.set(reduced ? 1 : withTiming(1, { duration: motion.standard }))
    } else if (reduced || !exiting) {
      progress.set(0)
    } else {
      progress.set(
        withTiming(0, { duration: motion.standard }, finished => {
          if (finished) runOnJS(finishExit)()
        }),
      )
    }
    return () => cancelAnimation(progress)
  }, [visible, exiting, reduced, motionPreference, progress, finishExit])

  // `onClosed` (see the prop): iOS says so through `Modal.onDismiss`; Android
  // and web have no such event, and their modal is gone once it unmounts.
  const closedRef = useRef(onClosed)
  useEffect(() => {
    closedRef.current = onClosed
  }, [onClosed])
  const wasMounted = useRef(mounted)
  useEffect(() => {
    if (wasMounted.current && !mounted && Platform.OS !== 'ios') closedRef.current?.()
    wasMounted.current = mounted
  }, [mounted])
  const dismissed = useCallback(() => closedRef.current?.(), [])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }))
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.get()) * windowHeight }] }))

  // Keep the focused field visible once the panel has made room for the keyboard.
  const focusedGroup = useRef<View>(null)
  const scrollRef = useRef<ScrollView>(null)
  const contentRef = useRef<View>(null)
  const scrollY = useRef(0)
  const viewportHeight = useRef(0)
  useEffect(() => {
    if (!mounted || !scroll) return
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const input = TextInput.State.currentlyFocusedInput()
      const content = contentRef.current
      if (!input || !content) return
      // One frame for the avoiding view's padding to land in layout.
      requestAnimationFrame(() => {
        try {
          const target = focusedGroup.current ?? input
          target.measureLayout(
            content,
            (_x, y, _width, height) => {
              const bottom = y + height + FOCUS_MARGIN
              const visibleBottom = scrollY.current + viewportHeight.current
              if (bottom > visibleBottom) {
                scrollRef.current?.scrollTo({ y: bottom - viewportHeight.current, animated: !reduced })
              }
            },
            () => {},
          )
        } catch {
          // A field that is not inside this sheet: nothing to scroll.
        }
      })
    })
    return () => subscription.remove()
  }, [mounted, scroll, reduced])

  // The keyboard covers the home indicator; the safe area only matters without it.
  const bottomPadding = (keyboardVisible ? 0 : insets.bottom) + spacing[5]

  return (
    <FocusedFieldGroup.Provider value={focusedGroup}>
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? dismissed : undefined}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
      <KeyboardAvoidingView
        behavior="padding"
        enabled={Platform.OS !== 'web'}
        style={styles.root}
        // Closing: still on screen for the exit slide, but no longer there for
        // touch or a screen reader.
        pointerEvents={visible ? 'auto' : 'none'}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      >
        <Animated.View testID="sheet-backdrop" style={[styles.backdrop, !reduced && backdropStyle]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={styles.backdropButton}
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          onAccessibilityEscape={onClose}
          style={[
            styles.panel,
            appearance === 'discovery' && styles.discoveryPanel,
            size === 'full' ? styles.panelFull : { maxHeight },
            !scroll && !footer && { paddingBottom: bottomPadding },
            !reduced && panelStyle,
          ]}
        >
          {swipeToClose ? <GestureDetector gesture={Gesture.Pan().withTestId('sheet-dismiss').activeOffsetY(10).onEnd(event => {
            if (event.translationY > 40 || event.velocityY > 500) runOnJS(onClose)()
          })}><View testID="sheet-drag-handle" style={styles.dragHandle}><View style={[styles.handle, appearance === 'discovery' && styles.discoveryHandle]} /></View></GestureDetector> : <View style={[styles.handle, appearance === 'discovery' && styles.discoveryHandle]} />}
          {header}
          {scroll ? (
            <ScrollView
              ref={scrollRef}
              style={size === 'full' ? styles.bodyFull : styles.body}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={event => {
                scrollY.current = event.nativeEvent.contentOffset.y
              }}
              onLayout={event => {
                viewportHeight.current = event.nativeEvent.layout.height
              }}
              contentContainerStyle={{ paddingBottom: footer ? spacing[4] : bottomPadding }}
            >
              <View ref={contentRef} collapsable={false}>
                {children}
              </View>
            </ScrollView>
          ) : (
            <View style={size === 'full' ? styles.bodyFull : styles.body}>{children}</View>
          )}
          {footer ? <View style={{ paddingBottom: bottomPadding }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
    </FocusedFieldGroup.Provider>
  )
}
