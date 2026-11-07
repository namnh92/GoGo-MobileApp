import { act, fireEvent } from '@testing-library/react-native'
import { AccessibilityInfo, Animated, Text } from 'react-native'
import { useState } from 'react'
import { renderScreen } from '../__tests__/harness'
import { scriptedTime } from '../__tests__/scripted-time'
import { motion } from '@/shared/ui/tokens'
import { SearchMapPanel } from './search-map-panel.view'

scriptedTime()
afterEach(() => jest.restoreAllMocks())

function Panel() {
  const [expanded, setExpanded] = useState(false)
  return <SearchMapPanel expanded={expanded} onExpandedChange={setExpanded}><Text>Map</Text></SearchMapPanel>
}

it.each([false, true])('uses token timing, or instant expansion and return for reduced motion %s', async reduced => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced)
  const timing = jest.spyOn(Animated, 'timing')
  const view = await renderScreen(<Panel />)
  timing.mockClear()
  await fireEvent.press(view.getByText('Mở rộng bản đồ'))
  expect(view.getByTestId('search-map-fullscreen')).toBeTruthy()
  if (reduced) expect(timing).not.toHaveBeenCalled()
  else expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: motion.standard, useNativeDriver: true }))
  await act(async () => { await jest.advanceTimersByTimeAsync(motion.standard + 32) })
  timing.mockClear()
  await fireEvent.press(view.getByText('Trở về tìm kiếm'))
  if (reduced) {
    expect(timing).not.toHaveBeenCalled()
    expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
  } else {
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: motion.standard }))
    expect(view.getByTestId('search-map-fullscreen')).toBeTruthy()
    await act(async () => { await jest.advanceTimersByTimeAsync(motion.standard + 32) })
    expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
  }
})

it('leaves horizontal drags and pinch gestures to the native map', async () => {
  const view = await renderScreen(<Panel />)
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchStart', { nativeEvent: { pageX: 300, pageY: 300 } })
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchEnd', { nativeEvent: { pageX: 100, pageY: 290 } })
  expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchStart', { nativeEvent: { pageX: 100, pageY: 300 } })
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchMove', { nativeEvent: { touches: [{}, {}] } })
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchEnd', { nativeEvent: { pageX: 100, pageY: 100 } })
  expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
})

// The native map must never be inside the expand gesture's touch target.
it.each([false, true])('keeps map pans outside the expand gesture when expanded=%s', async expanded => {
  const changed = jest.fn()
  const view = await renderScreen(<SearchMapPanel expanded={expanded} onExpandedChange={changed}><Text testID="native-map">Map</Text></SearchMapPanel>)
  let ancestor = view.getByTestId('native-map').parent
  while (ancestor) {
    for (const handler of ['onTouchStart', 'onTouchMove', 'onTouchEnd', 'onMoveShouldSetResponder', 'onMoveShouldSetResponderCapture']) {
      expect(ancestor.props[handler]).toBeUndefined()
    }
    expect(ancestor.props.testID).not.toBe('search-map-expand-handle')
    ancestor = ancestor.parent
  }
  await fireEvent(view.getByTestId('native-map'), 'touchStart', { nativeEvent: { pageX: 100, pageY: 300 } })
  await fireEvent(view.getByTestId('native-map'), 'touchEnd', { nativeEvent: { pageX: 100, pageY: 100 } })
  expect(changed).not.toHaveBeenCalled()
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchStart', { nativeEvent: { pageX: 100, pageY: expanded ? 100 : 300 } })
  await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchEnd', { nativeEvent: { pageX: 100, pageY: expanded ? 300 : 100 } })
  expect(changed).toHaveBeenCalledWith(!expanded)
})
