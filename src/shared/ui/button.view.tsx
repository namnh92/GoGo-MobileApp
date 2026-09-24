import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import { haptic } from '@/shared/ui/feedback'
import { Text, type TextColor } from '@/shared/ui/text'
import type { AppTheme } from '@/shared/ui/theme'
import { hitSlop } from '@/shared/ui/tokens'

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
 * A long label ellipsises on one line; it never shrinks to fit.
 */

export interface ButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
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
    const onAccentPressed = kind === 'primary' ? styles.primaryOnAccentPressed : styles.secondaryOnAccentPressed
    return [styles[kind], onAccentBase, pressed && onAccentPressed, disabled && styles.onAccentInactive]
  }
  return [styles[kind], pressed && styles[`${kind}Pressed`], disabled && styles[`${kind}Disabled`]]
}

function Button({ kind, label, onPress, disabled = false, loading = false, onAccent = false, style }: ButtonProps & {
  kind: Kind
  onAccent?: boolean
}) {
  const { theme } = useUnistyles()
  const inactive = disabled || loading
  const look = (onAccent ? ON_ACCENT_LOOK[kind] : undefined) ?? LOOK[kind]
  return (
    <Pressable
      onPress={() => {
        haptic(HAPTIC[kind])
        onPress()
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        ...kindStyles(kind, onAccent, pressed && !inactive, disabled || (onAccent && loading)),
        style,
      ]}
    >
      {loading ? <ActivityIndicator testID="button-spinner" size="small" color={look.spinner(theme)} /> : null}
      <Text
        variant="label"
        color={disabled ? look.disabledLabel : look.label}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.label}
      >
        {label}
      </Text>
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
export function IconBtn({ children, onPress, accessibilityLabel, active = false, disabled = false, style }: {
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
      style={({ pressed }) => [
        styles.icon,
        active && styles.iconActive,
        pressed && !disabled && styles.iconPressed,
        disabled && styles.iconDisabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}
