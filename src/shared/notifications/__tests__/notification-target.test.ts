import { describe, expect, it } from 'vitest'

import { notificationTarget } from '../notification-target'

/**
 * GoGo-MobileApp#256 — the payload → destination mapping, without a navigator.
 * Contract v1 is GoGo-BE#594; the kind fallback covers pushes DEV sends today
 * (`kind`, `roomId`, `eventType` only).
 */

const ROOM = '0b7c1f0e-3a55-4d1c-9a5e-2f6d8c4b1a01'
const PLAN = '5e2a9d7c-8b41-4f0a-b6e3-9c1d2a7f4e02'

describe('notificationTarget', () => {
  it('opens the canonical route, on any flavour scheme', () => {
    expect(notificationTarget({ route: `gogo://plan/${PLAN}` })).toEqual({
      status: 'open',
      action: { kind: 'plan', planId: PLAN },
      via: 'route',
      key: null,
    })
    expect(notificationTarget({ route: `gogo-dev://room/${ROOM}` })).toMatchObject({
      action: { kind: 'room', roomId: ROOM },
      via: 'route',
    })
  })

  it('prefers the route over the kind fallback', () => {
    expect(notificationTarget({ route: `gogo://plan/${PLAN}`, kind: 'invite', roomId: ROOM })).toMatchObject({
      action: { kind: 'plan', planId: PLAN },
      via: 'route',
    })
  })

  it.each(['invite', 'preference_reminder'])('%s without a route opens the room', kind => {
    expect(notificationTarget({ kind, roomId: ROOM, eventType: 'member.joined' })).toMatchObject({
      status: 'open',
      action: { kind: 'room', roomId: ROOM },
      via: 'kind',
    })
  })

  it.each(['plan_ready', 'plan_changed', 'date_reminder'])('%s opens the plan it names, else the room', kind => {
    expect(notificationTarget({ kind, roomId: ROOM, planId: PLAN })).toMatchObject({
      action: { kind: 'plan', planId: PLAN },
    })
    expect(notificationTarget({ kind, roomId: ROOM })).toMatchObject({ action: { kind: 'room', roomId: ROOM } })
  })

  it('reads type and entityType/entityId the way contract v1 sends them', () => {
    expect(notificationTarget({ type: 'plan_changed', entityType: 'plan', entityId: PLAN })).toMatchObject({
      action: { kind: 'plan', planId: PLAN },
      via: 'kind',
    })
  })

  it('never opens an invite or a share slug from a push', () => {
    expect(notificationTarget({ route: 'gogo://r/INVITECODE42' })).toEqual({ status: 'invalid', key: null })
    expect(notificationTarget({ route: 'gogo://l/abcd1234' })).toEqual({ status: 'invalid', key: null })
    // A usable fallback still wins over a route that names a credential.
    expect(notificationTarget({ route: 'gogo://r/INVITECODE42', kind: 'invite', roomId: ROOM })).toMatchObject({
      action: { kind: 'room', roomId: ROOM },
      via: 'kind',
    })
  })

  it('refuses ids that are not UUIDs and kinds it does not know', () => {
    expect(notificationTarget({ kind: 'invite', roomId: 'abc' }).status).toBe('invalid')
    expect(notificationTarget({ kind: 'campaign', roomId: ROOM }).status).toBe('invalid')
    expect(notificationTarget({ route: 'gogo://room/not-a-uuid' }).status).toBe('invalid')
  })

  it.each([null, undefined, 'plan_ready', 42, []])('treats %j as an invalid payload', raw => {
    expect(notificationTarget(raw)).toEqual({ status: 'invalid', key: null })
  })

  it('keeps the other fields when one is malformed', () => {
    expect(notificationTarget({ route: 123, kind: 'invite', roomId: ROOM })).toMatchObject({
      action: { kind: 'room', roomId: ROOM },
    })
  })

  it('keys by the contract notificationId, else the provider id', () => {
    expect(notificationTarget({ kind: 'invite', roomId: ROOM, notificationId: 'evt-1' }, 'os-1').key).toBe('evt-1')
    expect(notificationTarget({ kind: 'invite', roomId: ROOM }, 'os-1').key).toBe('os-1')
  })
})
