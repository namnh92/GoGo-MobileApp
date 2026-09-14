import { describe, expect, it } from 'vitest'

import { postAuthRoute } from './post-auth-route'

describe('postAuthRoute', () => {
  it('keeps the existing destinations', () => {
    expect(postAuthRoute('create')).toBe('/create/mood')
    expect(postAuthRoute('saved')).toBe('/(tabs)/saved')
    expect(postAuthRoute(undefined)).toBe('/(tabs)')
  })

  it('returns to the place a guest was reading (APP-060)', () => {
    expect(postAuthRoute('place:7a0c2f7e-2f3b-4b8e-9d57-0b6a5f1d9c11')).toBe(
      '/places/7a0c2f7e-2f3b-4b8e-9d57-0b6a5f1d9c11',
    )
  })

  it('goes home for a place target that is not an id', () => {
    expect(postAuthRoute('place:../../settings')).toBe('/(tabs)')
    expect(postAuthRoute('place:')).toBe('/(tabs)')
  })
})
