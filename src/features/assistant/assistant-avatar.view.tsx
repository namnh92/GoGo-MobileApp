import { View } from 'react-native'

import { AssistantGlyph } from '@/shared/ui/icons'

/** Design system `AssistantAvatar` sizes: entry points, messages, header, welcome. */
export const AVATAR_SIZE = { xs: 22, sm: 28, md: 36, lg: 64 } as const

/**
 * The assistant's face (GoGo-MobileApp#379): the solid speech-bubble glyph,
 * no tile behind it. Hidden from screen readers — "GoGo AI" is always written
 * or announced next to it.
 */
export function AssistantAvatar({ size = 'md', inverted = false }: { size?: keyof typeof AVATAR_SIZE; inverted?: boolean }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <AssistantGlyph size={AVATAR_SIZE[size]} inverted={inverted} testID={`assistant-avatar-${size}`} />
    </View>
  )
}
