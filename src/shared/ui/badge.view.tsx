import { View, type StyleProp, type ViewStyle } from 'react-native'

import { Text, type TextColor } from '@/shared/ui/text'

import { styles } from './badge.style'
import { MaterialIcon, type MaterialIconName } from './material-icon'

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
export function Badge({ label, tone = 'accent', accessibilityLabel, style, appearance = 'default', icon }: {
  appearance?: 'default' | 'stitchNeutral' | 'stitchViolet' | 'stitchGreen' | 'stitchWhite'
  icon?: MaterialIconName
  label: string
  tone?: BadgeTone
  /** When the word alone is ambiguous out of context ("Mới" → "Tính năng mới"). */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.badge, styles[tone], appearance !== 'default' && styles[appearance], style]}>
      {icon && <MaterialIcon name={icon} size={14} color={appearance === 'stitchViolet' ? 'redesign.violetInk' : appearance === 'stitchGreen' ? 'redesign.white' : 'redesign.greenText'} />}
      <Text variant={appearance === 'default' ? 'caption' : 'introCaption'} color={appearance === 'default' ? LABEL[tone] : appearance === 'stitchViolet' ? 'redesign.violetInk' : appearance === 'stitchGreen' ? 'redesign.white' : 'redesign.secondary'} numberOfLines={appearance === 'default' ? 1 : undefined} accessibilityLabel={accessibilityLabel}>
        {label}
      </Text>
    </View>
  )
}
