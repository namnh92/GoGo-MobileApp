import { isLiquidGlassSupported, LiquidGlassView } from '@callstack/liquid-glass'
import { BlurView } from 'expo-blur'
import type { ReactNode } from 'react'
import { Platform, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'

import { glassFx, spacing } from '@/shared/ui/tokens'

import { styles } from './glass-bar.style'

export { TAB_BAR_HEIGHT, useBottomBarInset } from './bottom-bar-inset'

/**
 * Which material a glass bar is drawn with (#293 §5):
 * - `native` — iOS 26 system glass, where the binary and OS support it.
 * - `blur` — older iOS: `expo-blur` under the 78 % wash.
 * - `wash` — Android: the wash alone (see `glass.bar` in `tokens.ts`).
 *
 * The wash is on every path — system glass included (#296 F-01) — so contrast
 * never depends on the blurred layer.
 */
export type GlassMaterial = 'native' | 'blur' | 'wash'

export function selectGlassMaterial(os: typeof Platform.OS, liquidGlassSupported: boolean): GlassMaterial {
  if (os !== 'ios') return 'wash'
  return liquidGlassSupported ? 'native' : 'blur'
}

/**
 * Third-party native views (`BlurView`, `LiquidGlassView`) are not React
 * Native views Unistyles can bind to — the same reason `PlacePhoto` gives
 * `expo-image` a static style. They fill a plain `View` that carries the
 * themed style.
 */
const NATIVE_FILL = { flex: 1 } as const

function Material({ material }: { material: GlassMaterial }) {
  const { theme } = useUnistyles()
  return (
    <>
      {material === 'native' ? (
        <View testID="glass-bar-native" pointerEvents="none" style={styles.fill}>
          <LiquidGlassView effect="regular" colorScheme="light" tintColor={glassFx.nativeTint} style={NATIVE_FILL} />
        </View>
      ) : null}
      {material === 'blur' ? (
        <View testID="glass-bar-blur" pointerEvents="none" style={styles.fill}>
          <BlurView intensity={theme.glass.bar.intensity} tint="light" style={NATIVE_FILL} />
        </View>
      ) : null}
      <View testID="glass-bar-wash" pointerEvents="none" style={[styles.fill, styles.wash]} />
    </>
  )
}

/**
 * Where a bar sits:
 * - `fill` — background only; the caller positions it. The tab bar passes it
 *   as `tabBarBackground`, filling the navigator's bar.
 * - `floating` — a fixed action bar pinned to the bottom edge over a scroll
 *   view: content scrolls under the glass, and the scroll view pads its end
 *   with `useBottomBarInset(height)`.
 * - `docked` — the same bar in the layout flow, under a screen whose content
 *   does not scroll (a step with a fixed form). Nothing runs under it, so it
 *   needs no inset.
 *
 * `floating` and `docked` carry the screen gutter, 16pt on top, and the safe
 * area plus 16pt underneath.
 */
export type GlassBarPlacement = 'fill' | 'floating' | 'docked'

/**
 * The one glass surface (#296): the tab bar and the fixed bottom action bars
 * (place detail, create flow). Never a card or a content background (#293 §5).
 *
 * `onHeightChange` reports the bar's height *without* the safe area — the
 * argument `useBottomBarInset` takes.
 */
export function GlassBar({ children, placement = 'fill', onHeightChange, style, testID }: {
  children?: ReactNode
  placement?: GlassBarPlacement
  onHeightChange?: (height: number) => void
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  const material = selectGlassMaterial(Platform.OS, isLiquidGlassSupported)
  const onLayout = onHeightChange
    ? (event: LayoutChangeEvent) => onHeightChange(Math.max(0, event.nativeEvent.layout.height - insets.bottom))
    : undefined
  const padded = placement !== 'fill'

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[
        styles.bar,
        padded && styles.padded,
        padded && { paddingBottom: insets.bottom + spacing[4] },
        placement === 'floating' && styles.floating,
        style,
      ]}
    >
      <Material material={material} />
      {children}
    </View>
  )
}
