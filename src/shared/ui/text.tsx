import type { Ref } from 'react'
import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native'
import { useAppTheme } from '@/shared/ui/scoped-theme'

import type { AppTheme } from '@/shared/ui/theme'
import { glyphText, type GlyphSize, type TypeStyle } from '@/shared/ui/tokens'

/**
 * The one text component (#293 §4). `variant` picks a type style — size, line
 * height and face together, so a screen cannot ask for "title2 but bolder" —
 * and `color` picks a semantic colour. Both are keys, never values: nothing a
 * screen writes here can be a hex or a `fontSize`.
 *
 * Accent colours come from the nearest app theme scope (or the running theme),
 * so a "Màu chủ đề" change repaints every `<Text color="accent.primary">`
 * without any screen knowing the theme exists. `useAppTheme` subscribes this component to theme
 * changes only (it tracks what is read, and only `theme` is), so an
 * orientation change or inset update does not re-render text.
 */

export type TextColor =
  | 'accent.textMuted'
  | 'status.onSuccessContainer'
  | 'accent.text'
  | 'text.primary'
  | 'text.secondary'
  | 'border.outline'
  | 'text.supporting'
  | 'status.successText'
  | 'status.infoText'
  | 'status.infoInk'
  | 'text.inverse'
  | 'text.neutralPrimary'
  | 'text.neutralSecondary'
  | 'surface.canvas'
  | 'text.tertiary'
  | 'accent.primary'
  | 'accent.onAccent'
  | 'accent.onSoft'
  | 'status.warningText'
  | 'status.dangerText'
  | 'onDark.success'
  | 'onDark.danger'
  | 'onDark.strong'
  | 'onDark.medium'
  | 'onDark.soft'

/**
 * `accent.primary` as text resolves to the Stitch `accent.text` shade. It can
 * differ from the fill in either mode; selected washes use `accent.onSoft`.
 *
 * A lookup rather than `key.split('.')`: the compiler checks every key resolves
 * to a string on the theme, and a renamed token fails here instead of at
 * runtime as `color: undefined`.
 */
const COLOR: Record<TextColor, (theme: AppTheme) => string> = {
  'accent.textMuted': theme => theme.accent.textMuted,
  'status.onSuccessContainer': theme => theme.status.onSuccessContainer,
  'accent.text': theme => theme.accent.text,
  'text.primary': theme => theme.text.primary,
  'text.secondary': theme => theme.text.secondary,
  'border.outline': theme => theme.border.outline,
  'text.supporting': theme => theme.text.supporting,
  'status.successText': theme => theme.status.successText,
  'status.infoText': theme => theme.status.infoText,
  'status.infoInk': theme => theme.status.infoInk,
  'text.inverse': theme => theme.text.inverse,
  'text.neutralPrimary': theme => theme.text.neutralPrimary,
  'text.neutralSecondary': theme => theme.text.neutralSecondary,
  'surface.canvas': theme => theme.surface.canvas,
  'text.tertiary': theme => theme.text.tertiary,
  'accent.primary': theme => theme.accent.text,
  'accent.onAccent': theme => theme.accent.onAccent,
  'accent.onSoft': theme => theme.accent.onSoft,
  'status.warningText': theme => theme.status.warningText,
  'status.dangerText': theme => theme.status.dangerText,
  'onDark.success': theme => theme.onDark.success,
  'onDark.danger': theme => theme.onDark.danger,
  'onDark.strong': theme => theme.onDark.strong,
  'onDark.medium': theme => theme.onDark.medium,
  'onDark.soft': theme => theme.onDark.soft,
}

/**
 * `style` is for layout — margins, flex, alignment, decoration. The type and
 * colour keys are removed from it at the type level, so the only way to set
 * them is through `variant` and `color`.
 */
/** The colour a semantic key resolves to under a theme — for SVG props, which are not styles. */
export function resolveColor(theme: AppTheme, key: TextColor): string {
  return COLOR[key](theme)
}

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
  const theme = useAppTheme()
  return <RNText ref={ref} {...rest} allowFontScaling={false} style={[theme.type[variant], { color: COLOR[color](theme) }, style]} />
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
  const theme = useAppTheme()
  return (
    <RNText
      ref={ref}
      {...rest}
      allowFontScaling={false}
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
  const theme = useAppTheme()
  const style =
    kind === 'emoji'
      ? { fontSize: box * 0.45 }
      : [theme.type.label, { fontSize: box * 0.38, lineHeight: box * 0.5, color: COLOR[color](theme) }]
  return <RNText allowFontScaling={false} style={style}>{children}</RNText>
}
