import { act, fireEvent } from '@testing-library/react-native'

/** Drive real Pressability; firing a nonexistent onPressIn prop misses pressed styles. */
export async function pressAndHold(target: Parameters<typeof fireEvent>[0]) {
  await act(async () => {
    await fireEvent(target, 'responderGrant', {
      nativeEvent: { timestamp: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0, touches: [], changedTouches: [] },
      persist: () => {},
      currentTarget: { measure: () => {} },
    })
  })
}
