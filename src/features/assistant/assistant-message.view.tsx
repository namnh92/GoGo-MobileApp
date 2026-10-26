import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'
import { motion } from '@/shared/ui/tokens'

import { AssistantAvatar } from './assistant-avatar.view'
import { styles } from './assistant-message.style'

/**
 * Design system `AssistantMessage`: the 28pt avatar, "GoGo AI · time", then
 * the reply straight on the canvas — never a bubble. Blocks come in the
 * design's order (lead → list → cards → sources → follow-ups); the caller
 * passes them so. A new reply enters with a 240 ms fade and 8pt rise, and
 * simply appears under reduced motion.
 */
export function AssistantMessage({ time, children, testID }: { time?: string; children: ReactNode; testID?: string }) {
  const { t } = useTranslation()
  const reduced = useReducedMotionPreference() ?? true
  const shown = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    shown.set(reduced ? 1 : withTiming(1, { duration: motion.standard }))
  }, [reduced, shown])
  const entering = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: 8 * (1 - shown.get()) }] }))
  return (
    <Animated.View testID={testID} style={[styles.row, !reduced && entering]}>
      <View style={styles.avatar}>
        <AssistantAvatar size="sm" />
      </View>
      <View style={styles.body}>
        <Text variant="caption" color="text.secondary">
          {time ? t('assistant.message.byline', { time }) : t('assistant.name')}
        </Text>
        {children}
      </View>
    </Animated.View>
  )
}
