import { describe, expect, it, vi } from 'vitest'

import { createPushPermission, type PushPermissionSdk } from '../permission'

/**
 * NTF-APP-003 (#50). The OS prompt can be shown once, so every branch here is
 * about not wasting it — and about the gap between "granted" and "messageable"
 * that cost a real debugging session on DEV.
 */
function sdk(over: Partial<PushPermissionSdk> = {}): PushPermissionSdk {
  return {
    hasPermission: async () => false,
    canRequestPermission: async () => true,
    requestPermission: async () => true,
    ...over,
  }
}

describe('contextual notification permission', () => {
  it('grants, and leaves the opt-in to the identity coordinator (#398 F-05)', async () => {
    // Granted is not subscribed, and an opt-in from here would land on whichever
    // identity the SDK holds when the prompt closes.
    const s = sdk()
    const events: string[] = []
    const p = createPushPermission({ sdk: s, report: (e) => events.push(e) })
    await expect(p.request()).resolves.toEqual({ kind: 'granted' })
    expect('optIn' in s).toBe(false)
    expect(events).toEqual(['push_permission_granted'])
  })

  it('granted: resumes the identity coordinator, which owns the opt-in (#398 F-05, F-13)', async () => {
    const resume = vi.fn()
    const p = createPushPermission({ sdk: sdk(), resume })
    await expect(p.request()).resolves.toEqual({ kind: 'granted' })
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('nothing changed, nothing resumed: denied, blocked, already granted, unavailable', async () => {
    const resume = vi.fn()
    for (const over of [
      { requestPermission: async () => false },
      { canRequestPermission: async () => false },
      { hasPermission: async () => true },
      { hasPermission: async () => { throw new Error('sdk') } },
    ] satisfies Partial<PushPermissionSdk>[]) {
      await createPushPermission({ sdk: sdk(over), resume }).request()
    }
    expect(resume).not.toHaveBeenCalled()
  })

  it('reports a denial', async () => {
    const s = sdk({ requestPermission: async () => false })
    const p = createPushPermission({ sdk: s })
    await expect(p.request()).resolves.toEqual({ kind: 'denied' })
  })

  it('tells a spent prompt apart from a fresh denial', async () => {
    // The distinction that matters: `denied` is a decision just made,
    // `blocked` is one made months ago that only Settings can undo. Calling
    // requestPermission when the prompt is spent resolves false and looks
    // exactly like the former.
    const s = sdk({ canRequestPermission: async () => false })
    const p = createPushPermission({ sdk: s })
    await expect(p.request()).resolves.toEqual({ kind: 'blocked' })
  })

  it('does not re-prompt a granted device', async () => {
    const s = sdk({ hasPermission: async () => true })
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

  it('never asks on its own — status() shows without prompting', async () => {
    const requestSpy = vi.fn()
    const s = sdk({ hasPermission: async () => false, requestPermission: requestSpy as never })
    const p = createPushPermission({ sdk: s })
    expect(await p.status()).toBe('askable')
    expect(requestSpy).not.toHaveBeenCalled()
  })

  it('status survives an SDK that throws', async () => {
    const s = sdk({ hasPermission: async () => { throw new Error('boom') } })
    expect(await createPushPermission({ sdk: s }).status()).toBe('unknown')
  })
})
