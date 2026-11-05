import { TAB_BAR_HEIGHT } from '@/shared/ui/bottom-bar-inset'

/** The tab bar plus the bottom safe area, from whichever inset is larger. */
export function fabBarInset(screenBottom: number, deviceBottom: number): number {
  return TAB_BAR_HEIGHT + Math.max(screenBottom, deviceBottom)
}
