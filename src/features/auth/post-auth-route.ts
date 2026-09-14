import type { Href } from 'expo-router'
import { z } from 'zod'

const PLACE_PREFIX = 'place:'
const placeId = z.string().uuid()

/**
 * Where sign-in lands, decided by an explicit `next` rather than by history.
 * `place:<uuid>` (APP-060) returns to the place a guest was reading when they
 * were asked to sign in; anything that does not validate goes home.
 */
export function postAuthRoute(next: string | undefined): Href {
  if (next === 'create') return '/create/mood'
  if (next === 'saved') return '/(tabs)/saved'
  if (next?.startsWith(PLACE_PREFIX)) {
    const parsed = placeId.safeParse(next.slice(PLACE_PREFIX.length))
    if (parsed.success) return `/places/${parsed.data}` as Href
  }
  return '/(tabs)'
}
