/**
 * Timers move only when the spec moves them (GoGo-MobileApp#407).
 *
 * A screen under test arms real timers: a list's 50 ms cell batch, a retry, a
 * scripted reply. A loaded machine fires them whenever it gets to them, between
 * a spec's steps or between two tests, outside `act`. jest.setup.js (#133) then
 * fails whichever test is current, often the next one. With this, `waitFor` and
 * `jest.advanceTimersByTimeAsync` advance time inside `act`, and whatever is
 * still scheduled when a test ends never fires.
 *
 * Call it once at the top of a spec whose screen arms a timer.
 */
export function scriptedTime() {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })
}
