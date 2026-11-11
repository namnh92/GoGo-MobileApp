import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { haptic } from './feedback'
import { Icon, type IconName } from './icons'
import { Text, type TextColor } from './text'
import { hitSlop, spacing, touchTarget } from './tokens'
import { styles } from './chip.style'

export type ChipVariant = 'default' | 'selected' | 'disabled' | 'info' | 'positive' | 'warning'
type ChipAppearance = 'default' | 'discovery' | 'mood' | 'soft' | 'raised'

// The smallest pill has 12pt horizontal padding per side. Expand its touch
// area without reserving invisible layout space between wrapped pills.
const chipHitSlop = {
  ...hitSlop,
  left: Math.max(hitSlop.left, (touchTarget.min - 2 * spacing[3]) / 2),
  right: Math.max(hitSlop.right, (touchTarget.min - 2 * spacing[3]) / 2),
}

const LABEL: Record<ChipVariant, TextColor> = {
  default: 'text.primary', selected: 'accent.onAccent', disabled: 'text.secondary',
  info: 'status.infoText', positive: 'status.successText', warning: 'status.warningText',
}

export interface ChipProps {
  label: string
  variant?: ChipVariant
  appearance?: ChipAppearance
  icon?: IconName
  /** Taxonomy illustration, independent of selection. */
  emoji?: string
  disabled?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  /** Independent removal action for contextual chips. */
  onRemove?: () => void
  removeAccessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Selection uses highlight + heavier text + a11y state, with no selection glyph. */
export function Chip({ label, variant = 'default', appearance = 'default', icon, emoji,
  disabled: disabledProp = false, onPress, accessibilityLabel, onRemove, removeAccessibilityLabel,
  style, testID }: ChipProps) {
  const selected = variant === 'selected'
  const disabled = disabledProp || variant === 'disabled'
  const stateVariant = disabled && !selected ? 'disabled' : variant
  // Semantic/disabled states keep their own foreground and surface in every appearance.
  const visual = stateVariant === 'default' || selected || appearance === 'raised' && stateVariant === 'disabled' ? appearance : 'default'
  const labelColor: TextColor = visual === 'raised' ? selected ? 'accent.onAccent' : 'text.secondary'
    : visual === 'soft' ? selected ? 'accent.onSoft' : 'text.secondary'
    : visual === 'mood' ? selected ? 'accent.onSoft' : 'text.secondary'
      : visual === 'discovery' ? selected ? 'accent.onSoft' : 'accent.text' : LABEL[stateVariant]
  const showIcon = icon && !(selected && (icon === 'check' || icon === 'checkCircle'))

  const body = (
    <View testID={!onPress ? testID : undefined}
      accessibilityState={{ selected, disabled }}
      style={[
        styles.chip, styles[`chip_${stateVariant}`],
        visual === 'discovery' && styles.discoveryChip, visual === 'discovery' && selected && styles.discoveryChipSelected,
        visual === 'soft' && styles.softChip, visual === 'soft' && selected && styles.softChipSelected,
        visual === 'mood' && styles.moodChip, visual === 'mood' && selected && styles.moodChipSelected,
        visual === 'raised' && styles.raisedChip, visual === 'raised' && selected && styles.raisedChipSelected,
        style,
      ]}>
      {showIcon ? <Icon name={icon} size={14} color={labelColor} /> : null}
      {!icon && emoji ? <Text variant="bodySmall">{emoji}</Text> : null}
      <Text variant={selected ? 'introLabel' : 'introSmall'} color={labelColor}
        numberOfLines={1} ellipsizeMode="tail" style={styles.chipLabel}
        accessibilityLabel={!onPress ? accessibilityLabel ?? label : undefined}>
        {label}
      </Text>
      {onRemove ? <Pressable onPress={onRemove} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={removeAccessibilityLabel ?? label} hitSlop={hitSlop} style={styles.remove}>
        <Icon name="x" size={14} color={labelColor} />
      </Pressable> : null}
    </View>
  )

  if (!onPress) return body
  return <Pressable testID={testID} style={styles.host} disabled={disabled}
    onPress={() => { haptic('select'); onPress() }}
    accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected, disabled }} hitSlop={chipHitSlop}>
    {body}
  </Pressable>
}
