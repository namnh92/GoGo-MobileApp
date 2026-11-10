import { act, cleanup } from '@testing-library/react-native'

/**
 * Timers move only when the spec moves them (GoGo-MobileApp#407/#606).
 *
 * A screen under test arms real timers: a list's 50 ms cell batch, a retry, a
 * scripted reply. A loaded machine fires them whenever it gets to them, between
 * a spec's steps or between two tests, outside `act`. jest.setup.js (#133) then
 * fails whichever test is current, often the next one. With this, `waitFor` and
 * `jest.advanceTimersByTimeAsync` advance time inside `act`. Teardown unmounts
 * first, drains pending callbacks inside `act`, then restores the real clock.
 * Keep the real FlatList/VirtualizedList and the #133 warning guard intact.
 *
 * Call it once at the top of a spec whose screen arms a timer.
 */
export function scriptedTime() {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] })
  })
  afterEach(async () => {
    try {
      // Own this order rather than depending on RNTL's auto-cleanup hook.
      await cleanup()
      await act(async () => { jest.runOnlyPendingTimers() })
    } finally {
      // A pending callback can schedule another timer (e.g. an animation).
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })
}
