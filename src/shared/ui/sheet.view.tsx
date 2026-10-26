import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type DimensionValue,
} from 'react-native'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { useKeyboardVisible } from '@/shared/ui/keyboard'
import { motion, spacing } from '@/shared/ui/tokens'

import { styles } from './sheet.style'

export interface SheetProps {
  visible: boolean
  /** Backdrop tap, Android back, the VoiceOver escape gesture. */
  onClose: () => void
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
}

/** Space kept between a focused field and the top of the keyboard. */
const FOCUS_MARGIN = spacing[4]

/**
 * The one bottom sheet (GoGo-MobileApp#381). Replaces the hand-written
 * `<Modal transparent animationType="slide">` copies, which slid the backdrop
 * up with the panel, ignored reduced motion, left the backdrop unnamed and let
 * the keyboard cover their inputs.
 *
 * - Motion: the panel rises over `motion.slow` (320 ms) while the backdrop
 *   fades in. With `Giảm chuyển động` on — or before the OS has answered — it
 *   is simply there: no slide, no fade.
 * - Keyboard: a `KeyboardAvoidingView` (React Native's own — a keyboard
 *   native module needs an ADR) pads the screen by however much the keyboard
 *   overlaps it. It measures the overlap, so a platform that already resized
 *   the window gets no second lift. The focused field is then scrolled into
 *   what is left of the panel.
 * - Screen readers: the backdrop is a button named "Đóng", and the escape
 *   gesture closes the sheet.
 */
export function Sheet({ visible, onClose, children, size = 'content', maxHeight = '85%', scroll = true, testID }: SheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  // Unknown counts as reduced: an instant cut is the harmless mistake (#338).
  const reduced = useReducedMotionPreference() ?? true
  const keyboardVisible = useKeyboardVisible()

  // Closing with motion keeps the sheet on screen for its exit slide. Derived
  // while rendering, so the frame that hides it is the one that starts the exit.
  const [shownFor, setShownFor] = useState(visible)
  const [exiting, setExiting] = useState(false)
  if (shownFor !== visible) {
    setShownFor(visible)
    setExiting(!visible && !reduced)
  }
  const mounted = visible || exiting
  const progress = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    if (visible) {
      progress.set(reduced ? 1 : withTiming(1, { duration: motion.slow }))
      return
    }
    if (!exiting) {
      progress.set(0)
      return
    }
    progress.set(
      withTiming(0, { duration: motion.slow }, finished => {
        if (finished) runOnJS(setExiting)(false)
      }),
    )
    // `progress` is a stable shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, exiting, reduced])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }))
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.get()) * windowHeight }] }))

  // Keep the focused field visible once the panel has made room for the keyboard.
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
          input.measureLayout(
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
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
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
        <Animated.View style={[styles.backdrop, !reduced && backdropStyle]}>
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
            size === 'full' ? styles.panelFull : { maxHeight },
            !scroll && { paddingBottom: bottomPadding },
            !reduced && panelStyle,
          ]}
        >
          <View style={styles.handle} />
          {scroll ? (
            <ScrollView
              ref={scrollRef}
              style={size === 'full' ? styles.bodyFull : styles.body}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={event => {
                scrollY.current = event.nativeEvent.contentOffset.y
              }}
              onLayout={event => {
                viewportHeight.current = event.nativeEvent.layout.height
              }}
              contentContainerStyle={{ paddingBottom: bottomPadding }}
            >
              <View ref={contentRef} collapsable={false}>
                {children}
              </View>
            </ScrollView>
          ) : (
            <View style={size === 'full' ? styles.bodyFull : styles.body}>{children}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
