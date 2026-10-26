import { act, render } from '@testing-library/react-native'
import { AccessibilityInfo, Platform } from 'react-native'

import { Toast } from '@/shared/ui/primitives'

/**
 * GoGo-MobileApp#381 — the toast relied on `accessibilityLiveRegion`, which is
 * Android-only: VoiceOver never read "Đã giữ … khi đổi phương án". iOS has to
 * be told through `announceForAccessibility`; Android keeps the live region
 * (announcing there too would read the message twice).
 */
describe('Toast × screen readers', () => {
  const os = Platform.OS
  afterEach(() => {
    Platform.OS = os
    jest.restoreAllMocks()
  })

  it('announces its message on iOS, and again when the message changes', async () => {
    Platform.OS = 'ios'
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
    announce.mockClear()
    const view = await render(<Toast message="Đã giữ Cafe A" />)
    expect(announce).toHaveBeenCalledWith('Đã giữ Cafe A')
    await act(async () => {
      await view.rerender(<Toast message="Đã bỏ giữ Cafe A" />)
    })
    expect(announce).toHaveBeenLastCalledWith('Đã bỏ giữ Cafe A')
    expect(announce).toHaveBeenCalledTimes(2)
  })

  it('leaves Android to the live region', async () => {
    Platform.OS = 'android'
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
    announce.mockClear()
    const view = await render(<Toast message="Đã giữ Cafe A" />)
    expect(announce).not.toHaveBeenCalled()
    expect(view.getByText('Đã giữ Cafe A')).toBeTruthy()
  })
})
