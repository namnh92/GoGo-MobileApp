import type { Ref } from 'react'
import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

import type { AppTheme } from '@/shared/ui/theme'
import { glyphText, type GlyphSize, type TypeStyle } from '@/shared/ui/tokens'

/**
 * The one text component (#293 §4). `variant` picks a type style — size, line
 * height and face together, so a screen cannot ask for "title2 but bolder" —
 * and `color` picks a semantic colour. Both are keys, never values: nothing a
 * screen writes here can be a hex or a `fontSize`.
 *
 * Accent colours come from the active Unistyles theme, so a "Màu chủ đề"
 * change repaints every `<Text color="accent.primary">` without any screen
 * knowing the theme exists. `useUnistyles` subscribes this component to theme
 * changes only (it tracks what is read, and only `theme` is), so an
 * orientation change or inset update does not re-render text.
 */

export type TextColor =
  | 'text.primary'
  | 'text.secondary'
  | 'text.tertiary'
  | 'text.inverse'
  | 'accent.primary'
  | 'accent.onAccent'
  | 'accent.onSoft'
  | 'status.successText'
  | 'status.warningText'
  | 'status.dangerText'
  | 'status.infoText'
  | 'onDark.strong'
  | 'onDark.medium'
  | 'onDark.soft'

/**
 * A lookup rather than `key.split('.')`: the compiler checks every key resolves
 * to a string on the theme, and a renamed token fails here instead of at
 * runtime as `color: undefined`.
 */
const COLOR: Record<TextColor, (theme: AppTheme) => string> = {
  'text.primary': theme => theme.text.primary,
  'text.secondary': theme => theme.text.secondary,
  'text.tertiary': theme => theme.text.tertiary,
  'text.inverse': theme => theme.text.inverse,
  'accent.primary': theme => theme.accent.primary,
  'accent.onAccent': theme => theme.accent.onAccent,
  'accent.onSoft': theme => theme.accent.onSoft,
  'status.successText': theme => theme.status.successText,
  'status.warningText': theme => theme.status.warningText,
  'status.dangerText': theme => theme.status.dangerText,
  'status.infoText': theme => theme.status.infoText,
  'onDark.strong': theme => theme.onDark.strong,
  'onDark.medium': theme => theme.onDark.medium,
  'onDark.soft': theme => theme.onDark.soft,
}

/**
 * `style` is for layout — margins, flex, alignment, decoration. The type and
 * colour keys are removed from it at the type level, so the only way to set
 * them is through `variant` and `color`.
 */
export type TextLayoutStyle = Omit<
  TextStyle,
  'color' | 'fontFamily' | 'fontSize' | 'fontStyle' | 'fontWeight' | 'lineHeight'
>

export type TextProps = Omit<RNTextProps, 'style'> & {
  variant?: TypeStyle
  color?: TextColor
  style?: StyleProp<TextLayoutStyle>
  ref?: Ref<RNText>
}

export function Text({ variant = 'body', color = 'text.primary', style, ref, ...rest }: TextProps) {
  const { theme } = useUnistyles()
  return <RNText ref={ref} {...rest} style={[theme.type[variant], { color: COLOR[color](theme) }, style]} />
}

export type GlyphProps = Omit<RNTextProps, 'style'> & {
  size: GlyphSize
  /** Only for a symbol drawn in a text colour (＋, ✓); emoji ignore it. */
  color?: TextColor
  style?: StyleProp<TextLayoutStyle>
  ref?: Ref<RNText>
}

/**
 * An emoji or symbol sized as a picture (#298): `size` is a `glyph` token, not
 * a step on the type scale — a 64pt 🎉 is an illustration, not a heading. No
 * face and no line height are set, so the glyph keeps its natural box.
 */
export function Glyph({ size, color, style, ref, ...rest }: GlyphProps) {
  const { theme } = useUnistyles()
  return (
    <RNText
      ref={ref}
      {...rest}
      style={[glyphText[size], color ? { color: COLOR[color](theme) } : null, style]}
    />
  )
}

/**
 * Text sized from the box it sits in (#298): an avatar's initials and emoji
 * scale with the avatar's `size` prop, so their size cannot be a step on any
 * scale. This is the one place a computed `fontSize` is written
 * (`type-scale.test.ts` lists it); initials keep the `label` face.
 */
export function ScaledText({ box, kind, color = 'accent.onAccent', children }: {
  /** The side of the square the text is centred in, in points. */
  box: number
  kind: 'initials' | 'emoji'
  color?: TextColor
  children: RNTextProps['children']
}) {
  const { theme } = useUnistyles()
  const style =
    kind === 'emoji'
      ? { fontSize: box * 0.45 }
      : [theme.type.label, { fontSize: box * 0.38, lineHeight: box * 0.5, color: COLOR[color](theme) }]
  return <RNText style={style}>{children}</RNText>
}
