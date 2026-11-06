import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Modal, View, useAnimatedValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { GhostBtn } from '@/shared/ui/primitives'
import { motion } from '@/shared/ui/tokens'
import { styles } from './search-map-panel.style'

/** Expand swipes belong to the header; map drags only move the native camera. */
export function SearchMapPanel({ children, expanded, onExpandedChange }: {
  children: ReactNode; expanded: boolean; onExpandedChange: (expanded: boolean) => void
}) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotionPreference() !== false
  const [presented, setPresented] = useState(expanded)
  const progress = useAnimatedValue(0)
  const touch = useRef<{ x: number; y: number } | null>(null)
  // Retain the modal only for an animated exit; reduced motion returns immediately.
  if (expanded !== presented && (expanded || reduced)) setPresented(expanded)
  useEffect(() => {
    if (reduced) {
      progress.setValue(expanded ? 1 : 0)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0, duration: motion.standard, useNativeDriver: true,
    })
    animation.start(({ finished }) => { if (finished && !expanded) setPresented(false) })
    return () => animation.stop()
  }, [expanded, reduced, progress])
  const content = <View testID="search-map-panel" style={styles.mapBlock}>
    {children}
    <View testID="search-map-expand-handle" style={[styles.mapExpand, { top: presented ? insets.top + 8 : 8 }]}
      onTouchStart={event => {
        touch.current = event.nativeEvent.touches?.length > 1 ? null : { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
      }}
      onTouchMove={event => { if (event.nativeEvent.touches?.length > 1) touch.current = null }}
      onTouchCancel={() => { touch.current = null }}
      onTouchEnd={event => {
        const start = touch.current
        touch.current = null
        if (!start) return
        const dy = event.nativeEvent.pageY - start.y
        const dx = event.nativeEvent.pageX - start.x
        if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          if (dy < 0 && !expanded) onExpandedChange(true)
          if (dy > 0 && expanded) onExpandedChange(false)
        }
      }}>
      <GhostBtn label={t(expanded ? 'discovery.collapseMap' : 'discovery.expandMap')} onPress={() => onExpandedChange(!expanded)} />
    </View>
  </View>
  if (!presented) return content
  return <Modal testID="search-map-modal" visible presentationStyle="fullScreen" animationType="none" onRequestClose={() => onExpandedChange(false)}>
    <Animated.View testID="search-map-fullscreen" style={[styles.mapFullscreen, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }] }]}>
      {content}
    </Animated.View>
  </Modal>
}
