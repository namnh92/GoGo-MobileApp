import { describe, expect, it } from 'vitest'

import { isUuid, parseDeepLink, routeForAction, routeForLink, systemPathFor } from '../deep-link'

const ID = '311f5bd8-f853-4ced-af68-e04398d1451a'

describe('parseDeepLink', () => {
  it('reads the same resource from a scheme link and a universal link', () => {
    // A custom scheme puts the first path segment where a URL parser expects the
    // host; treating both alike is what makes push and Safari agree.
    expect(parseDeepLink(`gogo-dev://room/${ID}`)).toEqual({ kind: 'room', roomId: ID })
    expect(parseDeepLink(`https://go-dev.gogo.id.vn/room/${ID}`)).toEqual({ kind: 'room', roomId: ID })
  })

  it('accepts the printed invite shape and the internal one', () => {
    expect(parseDeepLink('https://go.gogo.id.vn/r/YDi_00PB1z4FSQZjpLbgdw'))
      .toEqual({ kind: 'invite', inviteCode: 'YDi_00PB1z4FSQZjpLbgdw' })
    expect(parseDeepLink('gogo://invite/YDi_00PB1z4FSQZjpLbgdw'))
      .toEqual({ kind: 'invite', inviteCode: 'YDi_00PB1z4FSQZjpLbgdw' })
  })

  it('routes plans and places by id', () => {
    expect(parseDeepLink(`gogo://plans/${ID}`)).toEqual({ kind: 'plan', planId: ID })
    expect(parseDeepLink(`gogo://places/${ID}`)).toEqual({ kind: 'place', placeId: ID })
  })

  it('reads the destinations that carry no id', () => {
    expect(parseDeepLink('gogo://saved')).toEqual({ kind: 'saved' })
    expect(parseDeepLink('gogo://notifications')).toEqual({ kind: 'notifications' })
    expect(parseDeepLink('gogo://profile')).toEqual({ kind: 'profile' })
  })

  it('ignores query strings and fragments', () => {
    expect(parseDeepLink(`gogo://room/${ID}?utm_source=zalo#top`)).toEqual({ kind: 'room', roomId: ID })
  })

  it('rejects an id that is not a uuid rather than opening a dead screen', () => {
    expect(parseDeepLink('gogo://room/not-a-uuid')).toEqual({ kind: 'unknown', reason: 'invalid-params' })
    expect(parseDeepLink('gogo://plans/12345')).toEqual({ kind: 'unknown', reason: 'invalid-params' })
  })

  it('refuses an invite code carrying characters the server never mints', () => {
    expect(parseDeepLink('gogo://r/short')).toEqual({ kind: 'unknown', reason: 'invalid-params' })
    expect(parseDeepLink('gogo://r/has spaces!')).toEqual({ kind: 'unknown', reason: 'invalid-params' })
  })

  it('degrades safely on empty, malformed and unsupported links', () => {
    expect(parseDeepLink(null)).toEqual({ kind: 'unknown', reason: 'empty' })
    expect(parseDeepLink('')).toEqual({ kind: 'unknown', reason: 'empty' })
    expect(parseDeepLink('not a url at all')).toEqual({ kind: 'unknown', reason: 'unparseable' })
    expect(parseDeepLink('gogo://settings/danger')).toEqual({ kind: 'unknown', reason: 'unsupported' })
  })

  it('parses a canonical share slug without pretending it can resolve one', () => {
    // The slug resolves on `/l/[slug]` against the BFF; the parser stays offline.
    expect(parseDeepLink('https://go.gogo.id.vn/l/Af82Xc')).toEqual({ kind: 'shareSlug', slug: 'Af82Xc' })
    expect(routeForLink('https://go.gogo.id.vn/l/Af82Xc')).toBe('/l/Af82Xc')
  })
})

describe('routeForAction', () => {
  it('sends every resource to its screen', () => {
    expect(routeForAction({ kind: 'room', roomId: ID })).toBe(`/room/${ID}`)
    expect(routeForAction({ kind: 'invite', inviteCode: 'ABC123' })).toBe('/r/ABC123')
    expect(routeForAction({ kind: 'plan', planId: ID })).toBe(`/plans/${ID}`)
    expect(routeForAction({ kind: 'place', placeId: ID })).toBe(`/places/${ID}`)
    expect(routeForAction({ kind: 'saved' })).toBe('/(tabs)/saved')
    expect(routeForAction({ kind: 'notifications' })).toBe('/notifications')
    expect(routeForAction({ kind: 'profile' })).toBe('/(tabs)/profile')
    // A share link claimed by AASA must land on a route that exists — it used to
    // fall through to expo-router's developer 404 (GoGo-MobileApp#139).
    expect(routeForAction({ kind: 'shareSlug', slug: 'Af82Xc' })).toBe('/l/Af82Xc')
  })

  it('never leaves a bad link without a destination', () => {
    expect(routeForAction({ kind: 'unknown', reason: 'unsupported' })).toBe('/(tabs)')
  })
})

describe('isUuid', () => {
  it('accepts only contract ids', () => {
    expect(isUuid(ID)).toBe(true)
    for (const bad of ['room-1', 'YDi_00PB1z4FSQZjpLbgdw', '', undefined, null, 42, 'undefined']) {
      expect(isUuid(bad)).toBe(false)
    }
  })
})

describe('systemPathFor (GoGo-MobileApp#203)', () => {
  const CODE = 'YDi_00PB1z4FSQZjpLbgdw'

  it('sends a room link that carries an invite code to the invite route, keeping its form', () => {
    expect(systemPathFor(`gogo-dev://room/${CODE}`)).toBe(`gogo-dev://r/${CODE}`)
    expect(systemPathFor(`gogo://room/${CODE}`)).toBe(`gogo://r/${CODE}`)
    expect(systemPathFor(`gogo-stag://rooms/${CODE}`)).toBe(`gogo-stag://r/${CODE}`)
    expect(systemPathFor(`https://go-dev.gogo.id.vn/room/${CODE}?utm_source=zalo`)).toBe(`https://go-dev.gogo.id.vn/r/${CODE}`)
    expect(systemPathFor(`/room/${CODE}`)).toBe(`/r/${CODE}`)
  })

  it('passes a real room id and every other link through untouched', () => {
    for (const path of [
      `gogo-dev://room/${ID}`,
      `https://go-dev.gogo.id.vn/room/${ID}`,
      `gogo-dev://room/${ID}/preference`,
      `gogo-dev://room/${CODE}/preference`,
      `gogo-dev://r/${CODE}`,
      `https://go-dev.gogo.id.vn/r/${CODE}`,
      'https://go-dev.gogo.id.vn/l/Af82Xc',
      `gogo://plans/${ID}`,
      'gogo-dev://room/has spaces!',
      'gogo-dev://room/',
      'exp+gogo-dev://expo-development-client/?url=http%3A%2F%2F192.168.1.2%3A8081',
      '',
      'not a url at all',
    ]) {
      expect(systemPathFor(path)).toBe(path)
    }
  })

  it('never routes a rewritten link anywhere but the invite screen', () => {
    expect(routeForLink(systemPathFor(`gogo-dev://room/${CODE}`))).toBe(`/r/${CODE}`)
  })
})
