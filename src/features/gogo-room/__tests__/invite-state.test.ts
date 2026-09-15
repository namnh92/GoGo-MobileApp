import { describe, expect, it } from 'vitest'

import { isInviteUsable, resolveInviteDisplay, type InviteDisplayInput } from '../invite-state'

const NOW = Date.parse('2026-09-15T00:00:00.000Z')
const LATER = '2026-09-21T00:00:00.000Z'
const EARLIER = '2026-09-14T00:00:00.000Z'
const stored = { roomId: 'room-1', inviteId: 'invite-1', code: 'code-1', expiresAt: LATER, userId: 'user-1', savedAt: NOW - 1000 }
const row = (overrides: Record<string, unknown> = {}) => ({
  inviteId: 'invite-1', expiresAt: LATER, revoked: false, useCount: 0, maxUses: 20, ...overrides,
})
const input = (overrides: Partial<InviteDisplayInput>): InviteDisplayInput => ({
  stored: null, invites: [], invitesFailed: false, listIsCurrent: true, now: NOW, ...overrides,
})

describe('isInviteUsable', () => {
  it('rejects revoked, expired and used-up invites', () => {
    expect(isInviteUsable(row(), NOW)).toBe(true)
    expect(isInviteUsable(row({ revoked: true }), NOW)).toBe(false)
    expect(isInviteUsable(row({ expiresAt: EARLIER }), NOW)).toBe(false)
    expect(isInviteUsable(row({ useCount: 20 }), NOW)).toBe(false)
    expect(isInviteUsable(row({ maxUses: undefined, useCount: 500 }), NOW)).toBe(true)
  })
})

describe('resolveInviteDisplay (#199)', () => {
  it('waits for the device store and for the first list', () => {
    expect(resolveInviteDisplay(input({ stored: undefined })).display.kind).toBe('checking')
    expect(resolveInviteDisplay(input({ stored, invites: undefined })).display.kind).toBe('checking')
  })

  it('shows the stored code while its invite is usable', () => {
    const result = resolveInviteDisplay(input({ stored, invites: [row()] }))
    expect(result).toEqual({ display: { kind: 'code', inviteId: 'invite-1', code: 'code-1', expiresAt: LATER }, forget: false })
  })

  it.each([
    ['revoked', [row({ revoked: true })]],
    ['expired on the server', [row({ expiresAt: EARLIER })]],
    ['used up', [row({ useCount: 20 })]],
    ['no longer listed', []],
  ])('forgets a stored code whose invite is %s', (_label, invites) => {
    expect(resolveInviteDisplay(input({ stored, invites }))).toEqual({ display: { kind: 'none' }, forget: true })
  })

  it('forgets a code that has expired on this device', () => {
    const result = resolveInviteDisplay(input({ stored: { ...stored, expiresAt: EARLIER }, invites: [] }))
    expect(result).toEqual({ display: { kind: 'none' }, forget: true })
  })

  it('keeps a code a list older than it does not mention yet', () => {
    const result = resolveInviteDisplay(input({ stored, invites: [], listIsCurrent: false }))
    expect(result.display.kind).toBe('code')
    expect(result.forget).toBe(false)
  })

  it('names every usable invite from other devices, latest expiry first, with no code', () => {
    const result = resolveInviteDisplay(input({
      invites: [
        row({ inviteId: 'a', expiresAt: '2026-09-18T00:00:00.000Z' }),
        row({ inviteId: 'b' }),
        row({ inviteId: 'c', revoked: true }),
        row({ inviteId: 'd', useCount: 20 }),
      ],
    }))
    expect(result).toEqual({ display: { kind: 'active-elsewhere', inviteIds: ['b', 'a'], expiresAt: LATER }, forget: false })
  })

  it('never names the stored invite among the ones to revoke', () => {
    const result = resolveInviteDisplay(input({ stored, invites: [row({ revoked: true }), row({ inviteId: 'other' })] }))
    expect(result).toEqual({ display: { kind: 'active-elsewhere', inviteIds: ['other'], expiresAt: LATER }, forget: true })
  })

  it('says none when nothing usable is listed', () => {
    expect(resolveInviteDisplay(input({ invites: [row({ revoked: true })] })).display).toEqual({ kind: 'none' })
  })

  it('falls back to the stored code, or to unknown, when the list cannot be read', () => {
    expect(resolveInviteDisplay(input({ stored, invites: undefined, invitesFailed: true })).display.kind).toBe('code')
    expect(resolveInviteDisplay(input({ invites: undefined, invitesFailed: true })).display.kind).toBe('unknown')
    expect(resolveInviteDisplay(input({ invites: { unexpected: true } })).display.kind).toBe('unknown')
  })
})
