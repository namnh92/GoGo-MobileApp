import { describe, expect, it } from 'vitest'

import { notificationTarget } from '../notification-target'

/**
 * GoGo-MobileApp#256 — the payload → destination mapping, without a navigator.
 * Contract v1 is GoGo-BE#594; the kind fallback covers pushes DEV sends today
 * (`kind`, `roomId`, `eventType` only); campaigns come from the CMS dispatcher.
 */

const ROOM = '0b7c1f0e-3a55-4d1c-9a5e-2f6d8c4b1a01'
const PLAN = '5e2a9d7c-8b41-4f0a-b6e3-9c1d2a7f4e02'
const PLACE = '9a3e7c21-6b4d-4e8f-a1c2-3d4e5f6a7b8c'
const CAMPAIGN = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

describe('notificationTarget — transactional', () => {
  it('opens the canonical route, on any flavour scheme', () => {
    expect(notificationTarget({ route: `gogo://plan/${PLAN}`, type: 'plan_ready', roomId: ROOM })).toEqual({
      status: 'open',
      action: { kind: 'plan', planId: PLAN },
      via: 'route',
      key: null,
      kind: 'plan_ready',
      roomId: ROOM,
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
      kind,
      roomId: ROOM,
    })
  })

  it.each(['plan_ready', 'plan_changed', 'date_reminder'])('%s opens the plan it names, else the room', kind => {
    expect(notificationTarget({ kind, roomId: ROOM, planId: PLAN })).toMatchObject({
      action: { kind: 'plan', planId: PLAN },
    })
    expect(notificationTarget({ kind, roomId: ROOM })).toMatchObject({ action: { kind: 'room', roomId: ROOM }, kind })
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
    expect(notificationTarget({ kind: 'mystery', roomId: ROOM }).status).toBe('invalid')
    expect(notificationTarget({ route: 'gogo://room/not-a-uuid' }).status).toBe('invalid')
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

describe('notificationTarget — campaigns and payloads that name nothing', () => {
  it('opens a campaign place, or the saved tab', () => {
    expect(
      notificationTarget({ campaignId: CAMPAIGN, destinationType: 'place', destination: PLACE }, 'os-9'),
    ).toEqual({ status: 'campaign', destination: { kind: 'place', placeId: PLACE }, key: 'os-9' })
    expect(notificationTarget({ campaignId: CAMPAIGN, destinationType: 'saved' })).toMatchObject({
      destination: { kind: 'saved' },
    })
  })

  it.each([
    { campaignId: CAMPAIGN, destinationType: 'home' },
    { campaignId: CAMPAIGN, destinationType: 'recommendation', destination: PLACE },
    { campaignId: CAMPAIGN, destinationType: 'plan_template', destination: PLACE },
    { campaignId: CAMPAIGN, destinationType: 'external_url', destination: 'https://gogo.id.vn/uu-dai' },
    { campaignId: CAMPAIGN, destinationType: 'place', destination: 'not-a-uuid' },
  ])('sends campaign %j home, never to the unavailable notice', data => {
    expect(notificationTarget(data)).toMatchObject({ status: 'campaign', destination: null })
  })

  it.each([null, undefined, 'plan_ready', 42, [], {}, { eventType: 'plan.published' }])(
    'treats %j, which names no kind and no route, as non-transactional',
    raw => {
      expect(notificationTarget(raw)).toEqual({ status: 'campaign', destination: null, key: null })
    },
  )
})
