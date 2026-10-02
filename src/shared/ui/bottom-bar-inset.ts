import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Kept apart from `glass-bar.view` so a screen that only pads for the tab bar
// does not import the glass materials (expo-blur, liquid-glass) with it.

/**
 * Height of the tab bar above the safe area (#296). The Figma frame draws it at
 * 84 on an iPhone 16 Pro, whose bottom inset is 34: 84 = 50 + 34. Recorded as
 * that interpretation for design to confirm.
 */
export const TAB_BAR_HEIGHT = 50

/**
 * Space a scroll view leaves under a bottom bar so its last row clears it:
 * the bar's height plus the bottom safe area. Content still scrolls *under*
 * the glass; this only keeps the end reachable.
 *
 * Defaults to the tab bar. A fixed action bar passes the height `GlassBar`
 * reports through `onHeightChange` (which excludes the safe area).
 */
export function useBottomBarInset(barHeight: number = TAB_BAR_HEIGHT): number {
  const insets = useSafeAreaInsets()
  return barHeight + insets.bottom
}
