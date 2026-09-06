import { describe, expect, it, vi } from 'vitest'

import { createPushPermission, type PushPermissionSdk } from '../permission'

/**
 * NTF-APP-003 (#50). The OS prompt can be shown once, so every branch here is
 * about not wasting it — and about the gap between "granted" and "messageable"
 * that cost a real debugging session on DEV.
 */
function sdk(over: Partial<PushPermissionSdk> = {}): PushPermissionSdk & { optIn: ReturnType<typeof vi.fn> } {
  return {
    hasPermission: () => false,
    canRequestPermission: async () => true,
    requestPermission: async () => true,
    optIn: vi.fn(),
    ...over,
  } as PushPermissionSdk & { optIn: ReturnType<typeof vi.fn> }
}

describe('contextual notification permission', () => {
  it('grants, and opts the subscription in', async () => {
    // Granted is not subscribed. This is the step whose absence is invisible:
    // on DEV an adb-granted permission left messageable_players at 0.
    const s = sdk()
    const events: string[] = []
    const p = createPushPermission({ sdk: s, report: (e) => events.push(e) })
    await expect(p.request()).resolves.toEqual({ kind: 'granted' })
    expect(s.optIn).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['push_permission_granted'])
  })

  it('reports a denial without opting in', async () => {
    const s = sdk({ requestPermission: async () => false })
    const p = createPushPermission({ sdk: s })
    await expect(p.request()).resolves.toEqual({ kind: 'denied' })
    expect(s.optIn).not.toHaveBeenCalled()
  })

  it('tells a spent prompt apart from a fresh denial', async () => {
    // The distinction that matters: `denied` is a decision just made,
    // `blocked` is one made months ago that only Settings can undo. Calling
    // requestPermission when the prompt is spent resolves false and looks
    // exactly like the former.
    const s = sdk({ canRequestPermission: async () => false })
    const p = createPushPermission({ sdk: s })
    await expect(p.request()).resolves.toEqual({ kind: 'blocked' })
    expect(s.optIn).not.toHaveBeenCalled()
  })

  it('does not re-prompt a granted device, but still opts it in', async () => {
    const s = sdk({ hasPermission: () => true })
    const requestSpy = vi.fn()
    const p = createPushPermission({ sdk: { ...s, requestPermission: requestSpy as never } })
    await expect(p.request()).resolves.toEqual({ kind: 'already_granted' })
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('passes fallbackToSettings only when the caller asked for it', async () => {
    const calls: boolean[] = []
    const s = sdk({ requestPermission: async (f) => { calls.push(f); return true } })
    const p = createPushPermission({ sdk: s })
    await p.request()
    await p.request({ fallbackToSettings: true })
    expect(calls).toEqual([false, true])
  })

  it('an SDK failure is not a user decision', async () => {
    const s = sdk({ requestPermission: async () => { throw new Error('native boom') } })
    const p = createPushPermission({ sdk: s })
    await expect(p.request()).resolves.toEqual({ kind: 'unavailable' })
  })

  it('never asks on its own — status() shows without prompting', () => {
    const requestSpy = vi.fn()
    const s = sdk({ hasPermission: () => false, requestPermission: requestSpy as never })
    const p = createPushPermission({ sdk: s })
    expect(p.status()).toBe('askable')
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('status survives an SDK that throws', () => {
    const s = sdk({ hasPermission: () => { throw new Error('boom') } })
    expect(createPushPermission({ sdk: s }).status()).toBe('unknown')
  })
})
