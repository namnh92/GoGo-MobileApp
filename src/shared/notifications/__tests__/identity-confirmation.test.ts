import { describe, expect, it, vi } from 'vitest'

import {
  createIdentityConfirmation,
  isServerIssued,
  LOCAL_ID_PREFIX,
} from '../identity-confirmation'

/**
 * NTF-APP-004 (#161). The distinction this file exists for: the SDK having an
 * id is not the backend having accepted one. Under Identity Verification a
 * refused JWT leaves a `local-` id behind and otherwise looks like success —
 * which is precisely what was misread for days.
 */

const A = 'user-a'
const SERVER_ID = '0a11c859-4703-4cba-991f-dba81e7fd963'
const LOCAL_ID = `${LOCAL_ID_PREFIX}74ac1357-8b96-4276-b3e8-b3227e5bab08`

function reader(pairs: [string | null, string | null][]) {
  let i = 0
  return {
    getExternalId: vi.fn(async () => pairs[Math.min(i, pairs.length - 1)][0]),
    getOnesignalId: vi.fn(async () => {
      const value = pairs[Math.min(i, pairs.length - 1)][1]
      i += 1
      return value
    }),
  }
}

describe('what counts as a server-issued id', () => {
  it('rejects the SDK placeholder and accepts a real one', () => {
    expect(isServerIssued(LOCAL_ID)).toBe(false)
    expect(isServerIssued(SERVER_ID)).toBe(true)
    expect(isServerIssued(null)).toBe(false)
    expect(isServerIssued('')).toBe(false)
  })
})

describe('confirming that a login took', () => {
  const opts = { pollIntervalMs: 1, timeoutMs: 200 }

  it('confirms once the id stops being local', async () => {
    const report = vi.fn()
    const confirm = createIdentityConfirmation({
      reader: reader([[A, LOCAL_ID], [A, LOCAL_ID], [A, SERVER_ID]]),
      report,
      ...opts,
    })
    await expect(confirm(A, () => true)).resolves.toEqual({
      kind: 'confirmed',
      onesignalId: SERVER_ID,
    })
    expect(report).toHaveBeenCalledWith('push_identity_confirmed')
  })

  it('does NOT confirm while the id is still local — the refused-JWT shape', async () => {
    const report = vi.fn()
    const confirm = createIdentityConfirmation({
      reader: reader([[A, LOCAL_ID]]),
      report,
      ...opts,
    })
    await expect(confirm(A, () => true)).resolves.toEqual({ kind: 'unconfirmed' })
    expect(report).toHaveBeenCalledWith('push_identity_unconfirmed')
  })

  it('gives up when the external id never appears', async () => {
    const confirm = createIdentityConfirmation({
      reader: reader([[null, null]]),
      ...opts,
    })
    await expect(confirm(A, () => true)).resolves.toEqual({ kind: 'unconfirmed' })
  })

  it('reports superseded when the SDK has moved to another user', async () => {
    const confirm = createIdentityConfirmation({
      reader: reader([['user-b', SERVER_ID]]),
      ...opts,
    })
    await expect(confirm(A, () => true)).resolves.toEqual({
      kind: 'superseded',
      externalId: 'user-b',
    })
  })

  it('reports superseded the moment the caller says this login is stale', async () => {
    // The window that matters: confirmation takes seconds, and B can sign in
    // inside it. Resolving `confirmed` here would opt in on A's behalf.
    let current = true
    const confirm = createIdentityConfirmation({
      reader: reader([[A, LOCAL_ID], [A, SERVER_ID]]),
      ...opts,
    })
    const pending = confirm(A, () => current)
    current = false
    await expect(pending).resolves.toMatchObject({ kind: 'superseded' })
  })

  it('survives a reader that throws', async () => {
    const confirm = createIdentityConfirmation({
      reader: {
        getExternalId: vi.fn(async () => {
          throw new Error('bridge gone')
        }),
        getOnesignalId: vi.fn(async () => null),
      },
      ...opts,
    })
    await expect(confirm(A, () => true)).resolves.toEqual({ kind: 'unavailable' })
  })
})
