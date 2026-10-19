import { describe, expect, it } from 'vitest'

import { createNotificationClicks } from '../notification-clicks'

/** GoGo-MobileApp#364 (Sol F-02) — the deferred link asks whether a queued tap owns this launch. */
describe('launchClaimed', () => {
  const tap = { notification: { notificationId: 'n-1', additionalData: { type: 'room', roomId: 'x' } } }

  it('is false on a fresh instance', () => {
    expect(createNotificationClicks().launchClaimed()).toBe(false)
  })

  it('is true while a tap waits for an opener, and after the opener drains it', () => {
    const clicks = createNotificationClicks()
    clicks.handleClick(tap)
    expect(clicks.launchClaimed()).toBe(true)
    clicks.setOpener(() => undefined)
    expect(clicks.launchClaimed()).toBe(true)
  })

  it('a warm tap, with an opener already set, does not claim the launch', () => {
    const clicks = createNotificationClicks()
    clicks.setOpener(() => undefined)
    clicks.handleClick(tap)
    expect(clicks.launchClaimed()).toBe(false)
  })
})
