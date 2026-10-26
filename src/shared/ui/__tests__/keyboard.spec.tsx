import { act, renderHook } from '@testing-library/react-native'
import { DeviceEventEmitter } from 'react-native'

import { useKeyboardVisible } from '@/shared/ui/keyboard'

/** GoGo-MobileApp#381 — #379 hides the float button while the keyboard is up. */

const metrics = { screenX: 0, screenY: 544, width: 390, height: 300 }

it('follows the keyboard (iOS will-events, before the animation)', async () => {
  const { result } = await renderHook(() => useKeyboardVisible())
  expect(result.current).toBe(false)
  await act(async () => {
    DeviceEventEmitter.emit('keyboardWillShow', { endCoordinates: metrics, duration: 250, easing: 'keyboard' })
  })
  expect(result.current).toBe(true)
  await act(async () => {
    DeviceEventEmitter.emit('keyboardWillHide', { endCoordinates: { ...metrics, screenY: 844 }, duration: 250, easing: 'keyboard' })
  })
  expect(result.current).toBe(false)
})
