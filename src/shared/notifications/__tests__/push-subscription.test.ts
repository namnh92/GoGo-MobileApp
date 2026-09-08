import { describe, expect, it, vi } from 'vitest'

import { createPushRelease, RELEASE_CONFIRM_TIMEOUT_MS } from '../push-subscription'

/**
 * NTF-APP-004 (#160). The three things that make this more than a call to
 * `optOut()`: that it actually happens, that it cannot hold sign-out hostage,
 * and that a slow one cannot unsubscribe whoever signs in next.
 */

/** An SDK whose opt-out lands after `afterMs`, like the real fire-and-forget one. */
function subscription(options: { optedIn?: boolean; afterMs?: number; throws?: boolean } = {}) {
  let optedIn = options.optedIn ?? true
  const optOut = vi.fn(() => {
    if (options.throws) throw new Error('provider unavailable')
    if (options.afterMs === undefined) optedIn = false
    else setTimeout(() => { optedIn = false }, options.afterMs)
  })
  return {
    optOut,
    isOptedIn: vi.fn(async () => optedIn),
  }
}

describe('releasing this device on logout', () => {
  it('opts out, and says so only once the SDK agrees', async () => {
    const sdk = subscription()
    const report = vi.fn()
    const outcome = await createPushRelease({ subscription: sdk, report }).release()

    expect(sdk.optOut).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('released')
    expect(report).toHaveBeenCalledWith('push_release_released')
  })

  it('does not call optOut when the device is already opted out', async () => {
    const sdk = subscription({ optedIn: false })
    const outcome = await createPushRelease({ subscription: sdk }).release()

    expect(sdk.optOut).not.toHaveBeenCalled()
    expect(outcome).toBe('already_released')
  })

  it('gives up waiting rather than holding sign-out open', async () => {
    // The opt-out is enqueued and will send later; what must not happen is the
    // person waiting on it.
    const sdk = subscription({ afterMs: 60_000 })
    const report = vi.fn()
    const started = Date.now()
    const outcome = await createPushRelease({
      subscription: sdk,
      report,
      confirmTimeoutMs: 150,
    }).release()

    expect(outcome).toBe('pending')
    expect(Date.now() - started).toBeLessThan(1_000)
    expect(sdk.optOut).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('push_release_pending')
  })

  it('never rejects when the SDK throws — sign-out continues', async () => {
    const sdk = subscription({ throws: true })
    const report = vi.fn()
    await expect(
      createPushRelease({ subscription: sdk, report }).release(),
    ).resolves.toBe('unavailable')
    expect(report).toHaveBeenCalledWith('push_release_unavailable')
  })

  it('reports nothing as released once a later login has claimed the device', async () => {
    // The failure this prevents: A's release completing after B signed in, and
    // being counted as B's — or worse, unsubscribing B.
    const sdk = subscription({ afterMs: 40 })
    const report = vi.fn()
    const release = createPushRelease({ subscription: sdk, report, confirmTimeoutMs: 500 })

    const inFlight = release.release()
    release.invalidate() // B logs in
    const outcome = await inFlight

    expect(outcome).toBe('pending')
    expect(report).toHaveBeenCalledWith('push_release_superseded')
    expect(report).not.toHaveBeenCalledWith('push_release_released')
  })

  it('a second release supersedes the first', async () => {
    const sdk = subscription({ afterMs: 40 })
    const report = vi.fn()
    const release = createPushRelease({ subscription: sdk, report, confirmTimeoutMs: 500 })

    const first = release.release()
    const second = release.release()
    const [a, b] = await Promise.all([first, second])

    expect(a).toBe('pending')          // superseded
    expect(b).toBe('released')         // the current one
  })

  it('the default bound is short enough to sit between a tap and a screen change', () => {
    expect(RELEASE_CONFIRM_TIMEOUT_MS).toBeLessThanOrEqual(3_000)
  })
})
