import { View } from 'react-native'

import { Icon } from '@/shared/ui/icons'

import { styles } from './assistant-avatar.style'

/** Design system `AssistantAvatar` sizes: entry points, messages, header, welcome. */
export const AVATAR_SIZE = { xs: 22, sm: 28, md: 36, lg: 64 } as const

/** Decorative Stitch sparkle; nearby text supplies the assistant's name. */
export function AssistantAvatar({ size = 'md', inverted = false }: { size?: keyof typeof AVATAR_SIZE; inverted?: boolean }) {
  return (
    <View testID={`assistant-avatar-${size}`} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[styles.face, size === 'lg' && styles.hero, inverted && styles.inverted, { width: AVATAR_SIZE[size], height: AVATAR_SIZE[size] }]}>
      <Icon name="sparkle" size={AVATAR_SIZE[size] * 0.6} color={inverted || size === 'lg' ? 'accent.onSoft' : 'accent.onAccent'} />
    </View>
  )
}
