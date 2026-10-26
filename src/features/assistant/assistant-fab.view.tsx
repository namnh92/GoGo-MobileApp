import { useTranslation } from 'react-i18next'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { Badge } from '@/shared/ui/badge.view'
import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { AssistantGlyph } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { motion } from '@/shared/ui/tokens'

import { styles } from './assistant-fab.style'

/**
 * How the "Ask GoGo AI" label comes and goes as the button extends and
 * collapses: a short fade, or an instant cut under `Giảm chuyển động` — and
 * while the OS has not answered yet (#338).
 */
export function fabLabelMotion(reduced: boolean) {
  return reduced
    ? { entering: undefined, exiting: undefined }
    : { entering: FadeIn.duration(motion.fast), exiting: FadeOut.duration(motion.fast) }
}

/**
 * The GoGo AI float button (GoGo-MobileApp#379). Its accessible name is always
 * "Open GoGo AI"; the "New" badge is announced as a hint, not a new name.
 */
export function AssistantFab({ extended, isNew, highlight = false, onPress, style }: {
  extended: boolean
  isNew: boolean
  highlight?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotionPreference() ?? true
  const button = (
    <Pressable
      testID="assistant-fab"
      accessibilityRole="button"
      accessibilityLabel={t('assistant.fab.open')}
      accessibilityHint={isNew ? t('assistant.fab.newHint') : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, extended && styles.fabExtended, pressed && styles.fabPressed]}
    >
      <AssistantGlyph size={30} inverted />
      {extended ? (
        <Animated.View {...fabLabelMotion(reduced)}>
          <Text variant="title2" color="accent.onAccent" numberOfLines={1}>
            {t('assistant.fab.label')}
          </Text>
        </Animated.View>
      ) : null}
      {isNew ? <Badge label={t('assistant.badgeNew')} style={styles.badge} /> : null}
    </Pressable>
  )
  return (
    <View testID="assistant-fab-dock" style={[styles.dock, style]}>
      {highlight ? <View testID="assistant-fab-highlight" style={styles.ring}>{button}</View> : button}
    </View>
  )
}
