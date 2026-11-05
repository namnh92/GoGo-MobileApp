import { fabBarInset } from '@/features/assistant/fab-inset'
import { TAB_BAR_HEIGHT } from '@/shared/ui/bottom-bar-inset'

/**
 * The GoGo AI button sits `barInset` above the bottom, measured from the device
 * safe area. A tab screen that is handed a smaller bottom inset must still pad
 * its list by the same amount, or its last row ("Đăng xuất") stays under the button.
 */
describe('fabBarInset', () => {
  it('uses the screen inset when it is the device inset', () => {
    expect(fabBarInset(34, 34)).toBe(TAB_BAR_HEIGHT + 34)
  })

  it('uses the device inset when the screen was handed less', () => {
    expect(fabBarInset(0, 34)).toBe(TAB_BAR_HEIGHT + 34)
  })

  it('has no safe area to add on a device without one', () => {
    expect(fabBarInset(0, 0)).toBe(TAB_BAR_HEIGHT)
  })
})
