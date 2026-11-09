import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { haptic, useReducedMotion } from '@/shared/ui/feedback'
import { MaterialIcon, type MaterialIconName } from './material-icon'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Text, type TextColor } from '@/shared/ui/text'
import type { AppTheme } from '@/shared/ui/theme'
import { buttonSizes, hitSlop, type ButtonSize } from '@/shared/ui/tokens'

import { styles } from './button.style'

/**
 * The button family (#293 §2). One dominant `PrimaryBtn` per screen; the rest
 * are secondary, ghost, danger or icon-only. They share a radius, a label style
 * and one set of states — pressed, disabled, loading — so a screen never looks
 * like it borrowed a control from somewhere else.
 *
 * Loading keeps the label and puts a spinner beside it: the button says what is
 * in flight instead of turning into an anonymous spinner, and `Pressable` is
 * disabled for the whole request so a second tap never reaches `onPress`.
 * Default labels ellipsise on one line. Stitch labels wrap to preserve content.
 */

export interface ButtonProps {
  size?: ButtonSize
  variant?: 'pill' | 'default' | 'neutral' | 'neutralPill' | 'stitch' | 'stitchSubtle' | 'stitchGuest' | 'stitchSkip' | 'stitchSkipPill' | 'discovery' | 'discoveryJoin' | 'area'
  label: string
  /** Allow full action labels to wrap in narrow shared layouts. */
  wrapLabel?: boolean
  onPress: () => void
  /** Why the button is unavailable, or what it does, read after the label. */
  accessibilityHint?: string
  disabled?: boolean
  loading?: boolean
  /** A glyph drawn before the label, in the label's colour. Decorative: the label names the action. */
  icon?: IconName
  leadingIcon?: MaterialIconName
  trailingIcon?: MaterialIconName
  style?: StyleProp<ViewStyle>
}

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Look {
  label: TextColor
  disabledLabel: TextColor
  spinner: (theme: AppTheme) => string
}

const LOOK: Record<Kind, Look> = {
  primary: { label: 'accent.onAccent', disabledLabel: 'text.secondary', spinner: theme => theme.accent.onAccent },
  secondary: { label: 'accent.primary', disabledLabel: 'text.secondary', spinner: theme => theme.accent.primary },
  ghost: { label: 'accent.primary', disabledLabel: 'text.secondary', spinner: theme => theme.accent.primary },
  danger: { label: 'status.dangerText', disabledLabel: 'text.secondary', spinner: theme => theme.status.dangerText },
}

const NEUTRAL_LOOK: Look = {
  label: 'text.primary', disabledLabel: 'text.secondary', spinner: theme => theme.text.primary,
}

/** On an accent-coloured ground the two filled roles swap. */
const ON_ACCENT_LOOK: Partial<Record<Kind, Look>> = {
  primary: { label: 'accent.primary', disabledLabel: 'accent.primary', spinner: theme => theme.accent.primary },
  secondary: { label: 'accent.onAccent', disabledLabel: 'accent.onAccent', spinner: theme => theme.accent.onAccent },
}

const HAPTIC: Record<Kind, Parameters<typeof haptic>[0]> = {
  primary: 'impact',
  secondary: 'select',
  ghost: 'select',
  danger: 'warning',
}

function kindStyles(kind: Kind, onAccent: boolean, pressed: boolean, disabled: boolean) {
  if (onAccent && (kind === 'primary' || kind === 'secondary')) {
    const onAccentBase = kind === 'primary' ? styles.primaryOnAccent : styles.secondaryOnAccent
    return [styles[kind], onAccentBase, disabled && styles.onAccentInactive]
  }
  return [styles[kind], pressed && kind === 'primary' && styles.primaryPressed, disabled && styles[`${kind}Disabled`]]
}

function Button({ kind, label, onPress, accessibilityHint, disabled = false, loading = false, onAccent = false, icon, leadingIcon, trailingIcon, style, wrapLabel, variant = 'default', size = variant === 'stitchGuest' || variant === 'stitchSkip' || variant === 'stitchSkipPill' ? 'small' : 'regular' }: ButtonProps & {
  kind: Kind
  onAccent?: boolean
}) {
  const { theme } = useUnistyles()
  const reduced = useReducedMotion()
  const neutral = variant === 'neutral' || variant === 'neutralPill'
  const stitch = variant !== 'default' && !neutral
  const inactive = disabled || loading
  // Callers often pass `loading={pending} disabled={pending || …}`: while a
  // request is in flight the button reads as loading, not as greyed out.
  const greyed = disabled && !loading
  const look = variant === 'neutralPill' ? { ...NEUTRAL_LOOK, label: 'redesign.secondary' as const }
    : neutral ? NEUTRAL_LOOK : (onAccent ? ON_ACCENT_LOOK[kind] : undefined) ?? LOOK[kind]
  const iconColor: TextColor = variant === 'area' && kind === 'secondary' && !greyed ? 'redesign.primaryText' : greyed ? look.disabledLabel : variant === 'discoveryJoin' ? 'redesign.ink' : look.label
  return (
    <Pressable
      onPress={() => {
        haptic(HAPTIC[kind])
        onPress()
      }}
      hitSlop={hitSlop}
      disabled={inactive}
      accessibilityRole="button"
      // #271: Android writes contentDescription only when label + state is
      // non-empty, so without a label a button kept saying "busy" after loading.
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        // A neutral control never registers accent styles with the native
        // stylesheet, including the pressed/disabled/onAccent paths.
        ...(neutral ? [styles.neutral] : kindStyles(kind, onAccent, pressed && !inactive, onAccent ? inactive : greyed)),
        variant === 'neutralPill' && styles.neutralPill,
        stitch && styles[variant],
        variant === 'discovery' && kind === 'primary' && styles.discoveryPrimary,
        variant === 'area' && kind === 'primary' && styles.areaPrimary,
        variant === 'area' && greyed && styles.primaryDisabled,
        variant === 'discovery' && greyed && styles.primaryDisabled,
        stitch && pressed && !inactive && !reduced && (variant === 'stitchSubtle' ? styles.stitchPressedSubtle : styles.stitchPressed),
        styles[size],
        style,
      ]}
    >
      {loading ? <ActivityIndicator testID="button-spinner" size="small" color={look.spinner(theme)} /> : null}
      {icon && !loading && !stitch ? <Icon name={icon} size={buttonSizes[size].iconSize} color={iconColor} /> : null}
      {leadingIcon && !loading ? <MaterialIcon name={leadingIcon} size={buttonSizes[size].iconSize} color={iconColor} /> : null}
      <Text
        variant={buttonSizes[size].label}
        color={greyed ? look.disabledLabel : variant === 'area' && kind === 'secondary' ? 'redesign.secondary' : variant === 'discoveryJoin' ? 'redesign.ink' : stitch && kind === 'ghost' ? variant === 'stitchGuest' ? 'redesign.ink' : 'redesign.secondary' : look.label}
        numberOfLines={wrapLabel === false ? 1 : stitch || wrapLabel ? undefined : 1}
        ellipsizeMode="tail"
        style={styles.label}
      >
        {label}
      </Text>
      {trailingIcon && !loading ? <MaterialIcon name={trailingIcon} size={buttonSizes[size].iconSize} color={iconColor} /> : null}
      {stitch && icon && !trailingIcon && !loading ? <MaterialIcon name="arrowRight" size={buttonSizes[size].iconSize} color={iconColor} /> : null}
    </Pressable>
  )
}

export function PrimaryBtn(props: ButtonProps & { onAccent?: boolean }) {
  return <Button kind="primary" {...props} />
}

/**
 * The second action on a screen. Outlined rather than filled, so the eye still
 * lands on the primary — two filled CTAs side by side have no hierarchy at all.
 */
export function SecondaryBtn(props: ButtonProps & { onAccent?: boolean }) {
  return <Button kind="secondary" {...props} />
}

export function GhostBtn(props: ButtonProps) {
  return <Button kind="ghost" {...props} />
}

/** Destructive and irreversible — never the default action on a screen. */
export function DangerBtn(props: ButtonProps) {
  return <Button kind="danger" {...props} />
}

/**
 * Icon-only. The glyph is not a label, so `accessibilityLabel` is required —
 * a screen reader announcing "button" and nothing else is a dead end. Drawn at
 * 40pt with slop so the touch area still clears 44 (RULE-DS touch targets).
 */
export function IconBtn({ children, onPress, accessibilityLabel, active = false, disabled = false, style, size = 'small' }: {
  size?: ButtonSize
  children: ReactNode
  onPress: () => void
  accessibilityLabel: string
  active?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={() => {
        haptic('select')
        onPress()
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={hitSlop}
      style={[
        styles.icon,
        size === 'regular' ? styles.iconRegular : styles.iconSmall,
        active && styles.iconActive,
        disabled && styles.iconDisabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}
