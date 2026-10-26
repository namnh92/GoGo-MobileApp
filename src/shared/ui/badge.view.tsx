import { View, type StyleProp, type ViewStyle } from 'react-native'

import { Text, type TextColor } from '@/shared/ui/text'

import { styles } from './badge.style'

export type BadgeTone = 'accent' | 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const LABEL: Record<BadgeTone, TextColor> = {
  accent: 'accent.onSoft',
  // `text.secondary` measures 4.12 on `surface.subtle`.
  neutral: 'text.primary',
  info: 'status.infoText',
  success: 'status.successText',
  warning: 'status.warningText',
  danger: 'status.dangerText',
}

/**
 * A short status word — "Mới", "Đang mở" (#381, the assistant's "New" badge in
 * #379). Always text: colour is never the only signal, so there is no dot-only
 * variant, and `label` cannot be empty.
 */
export function Badge({ label, tone = 'accent', accessibilityLabel, style }: {
  label: string
  tone?: BadgeTone
  /** When the word alone is ambiguous out of context ("Mới" → "Tính năng mới"). */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.badge, styles[tone], style]}>
      <Text variant="caption" color={LABEL[tone]} numberOfLines={1} accessibilityLabel={accessibilityLabel}>
        {label}
      </Text>
    </View>
  )
}
