import { describe, expect, it, vi } from 'vitest'

import { goBackOrHome } from '../go-back-or-home'

type FakeRouter = Parameters<typeof goBackOrHome>[0]

function router(canGoBack: boolean) {
  const calls = { back: vi.fn(), replace: vi.fn() }
  return {
    fake: { canGoBack: () => canGoBack, back: calls.back, replace: calls.replace } as FakeRouter,
    calls,
  }
}

describe('goBackOrHome', () => {
  it('goes back when there is something behind the screen', () => {
    const { fake, calls } = router(true)

    goBackOrHome(fake)

    expect(calls.back).toHaveBeenCalledTimes(1)
    expect(calls.replace).not.toHaveBeenCalled()
  })

  /*
   * A cold start from a link leaves one route on the stack, so `back()` does
   * nothing: iOS shows an inert control with no edge swipe, Android's hardware
   * button closes the app (#268, seen on the invite screen as #218 I14).
   */
  it('leaves for the start screen when the stack holds only this one', () => {
    const { fake, calls } = router(false)

    goBackOrHome(fake)

    expect(calls.back).not.toHaveBeenCalled()
    // `/`, not `/(tabs)`: the splash is what decides between onboarding and
    // Home, so the tabs would walk a fresh install past onboarding.
    expect(calls.replace).toHaveBeenCalledWith('/')
  })
})
