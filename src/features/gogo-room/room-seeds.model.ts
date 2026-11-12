import type { RoomRole } from '@/shared/api/types'

/** BE#878 must expose/enable the member capability before a caller opts in. Guests never qualify. */
export function canSuggestPlaces(role: RoomRole | 'guest' | undefined, memberCapability = false): boolean {
  return role === 'host' || (role === 'member' && memberCapability)
}

/** Map either direction of the virtual row to its real seed. No seed means no index. */
export function seedIndex(virtualIndex: number, count: number): number | null {
  return count > 0 ? ((virtualIndex % count) + count) % count : null
}

/** The middle copy has identical neighbours, so an unanimated reset is invisible. */
export function recenterSeedIndex(virtualIndex: number, count: number): number {
  return count < 2 ? 0 : count + seedIndex(virtualIndex, count)!
}
