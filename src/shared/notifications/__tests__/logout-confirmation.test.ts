import { describe, expect, it, vi } from 'vitest'

import {
  createLogoutConfirmation,
  UnsubscribeNotConfirmedError,
} from '../logout-confirmation'

/**
 * NTF-APP-004 (#160). What is under test is the *ordering guarantee*: nothing
 * may report a finished logout until the provider says this device is no longer
 * live. Outcomes alone would pass even with the old enqueue-and-hope behaviour.
 */

const SUB = 'b3e26d4e-59dd-4eda-bd34-8261885ccefc'

function harness(overrides: Record<string, unknown> = {}) {
  const order: string[] = []
  const deps = {
    unsubscribe: vi.fn(async () => {
      order.push('unsubscribe')
    }),
    getSubscriptionId: vi.fn(async () => {
      order.push('read-id')
      return SUB
    }),
    confirm: vi.fn(async () => {
      order.push('confirm')
      return true
    }),
    report: vi.fn(),
    timeoutMs: 1_000,
    pollIntervalMs: 1,
    sleep: async () => {},
    ...overrides,
  }
  return { run: createLogoutConfirmation(deps as never), deps, order }
}

describe('unsubscribe then confirm, in that order (#160)', () => {
  it('asks the provider only after the SDK has been told to log out', async () => {
    const { run, order, deps } = harness()
    await run()
    expect(order).toEqual(['read-id', 'unsubscribe', 'confirm'])
    expect(deps.confirm).toHaveBeenCalledWith(SUB)
    expect(deps.report).toHaveBeenCalledWith('push_logout_confirmed')
  })

  it('keeps asking while the provider still has the device enabled', async () => {
    let calls = 0
    const { run, deps } = harness({
      confirm: vi.fn(async () => {
        calls += 1
        return calls >= 3
      }),
    })
    await run()
    expect(calls).toBe(3)
    expect(deps.report).toHaveBeenCalledWith('push_logout_confirmed')
  })

  it('throws rather than returning when it stays enabled past the bound', async () => {
    // The defect this slice exists for: reporting a logout the provider never
    // performed. Resolving here would let the caller wipe the session.
    const { run, deps } = harness({
      confirm: vi.fn(async () => false),
      timeoutMs: 0,
    })
    await expect(run()).rejects.toBeInstanceOf(UnsubscribeNotConfirmedError)
    await expect(run()).rejects.toMatchObject({ reason: 'still_enabled' })
    expect(deps.report).toHaveBeenCalledWith('push_logout_still_subscribed')
  })

  it('an unreachable backend is never read as success', async () => {
    const { run, deps } = harness({
      confirm: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    await expect(run()).rejects.toMatchObject({ reason: 'unavailable' })
    expect(deps.report).toHaveBeenCalledWith('push_logout_confirm_unavailable')
  })

  it('a device with no subscription has nothing to confirm', async () => {
    const { run, deps } = harness({ getSubscriptionId: vi.fn(async () => null) })
    await expect(run()).resolves.toBeUndefined()
    expect(deps.confirm).not.toHaveBeenCalled()
    // Deliberately its own reason code: "never had one" is a different fact
    // from "we watched it be torn down".
    expect(deps.report).toHaveBeenCalledWith('push_logout_no_subscription')
  })

  it('reads the subscription id before logging out, not after', async () => {
    // After logout the SDK holds an anonymous user. Asking it for "the"
    // subscription id then risks getting one the signed-in user never had, and
    // the backend would honestly report that id as not subscribed — a false
    // confirmation, on the exact path this guard exists to protect.
    const { run, order } = harness()
    await run()
    expect(order.indexOf('read-id')).toBeLessThan(order.indexOf('unsubscribe'))
  })

  it('a failing SDK logout stops before any confirmation is claimed', async () => {
    const { run, deps } = harness({
      unsubscribe: vi.fn(async () => {
        throw new Error('bridge gone')
      }),
    })
    await expect(run()).rejects.toThrow('bridge gone')
    expect(deps.confirm).not.toHaveBeenCalled()
    expect(deps.report).not.toHaveBeenCalledWith('push_logout_confirmed')
  })
})
