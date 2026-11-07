import { foldName, type AdministrativeUnit } from '@/shared/administrative/snapshot'
import type { Position } from './fresh-position'

/**
 * ADM-204 (#209) — where discovery should look, in the order the product asked
 * for: a fresh device position, else the account's canonical area, else an
 * Hồ Chí Minh default (owner O-6, #515). Never both: the server keeps a position and an
 * area apart, and so does this.
 */

export type ScopeArea = {
  datasetVersion: string
  provinceCode: string
  provinceName: string
  communeCode: string | null
  communeName: string | null
}

export type DiscoveryScope =
  | { status: 'resolving' }
  | { status: 'unavailable'; error: unknown; offline: boolean }
  | { status: 'ready'; source: 'gps'; position: Position }
  | { status: 'ready'; source: 'profile_area'; area: ScopeArea }
  | { status: 'ready'; source: 'selected_area' | 'default_area'; area: ScopeArea }
  | { status: 'ready'; source: 'none'; reason: 'no_area' | 'area_needs_reselection' }

type ProfileArea = (ScopeArea & { status: 'current' | 'needs_reselection' }) | null | undefined

/** Resolve the current municipality from the published source, never a pinned GSO code. */
export function defaultDiscoveryArea(version: string | undefined, provinces: AdministrativeUnit[] | undefined): ScopeArea | null {
  const province = provinces?.find(unit => unit.isCurrent && unit.status === 'ACTIVE' && unit.level === 'PROVINCE' && foldName(unit.name) === 'ho chi minh')
  return version && province ? { datasetVersion: version, provinceCode: province.code, provinceName: province.fullName, communeCode: null, communeName: null } : null
}

export function scopeFor(
  position: Position | null | undefined,
  profileArea: ProfileArea,
  profilePending: boolean,
): DiscoveryScope {
  if (position === undefined) return { status: 'resolving' }
  if (position) return { status: 'ready', source: 'gps', position }
  if (profilePending) return { status: 'resolving' }
  if (profileArea?.status === 'current') {
    const { status: _status, ...area } = profileArea
    return { status: 'ready', source: 'profile_area', area: { ...area, communeCode: area.communeCode ?? null, communeName: area.communeName ?? null } }
  }
  return {
    status: 'ready',
    source: 'none',
    reason: profileArea?.status === 'needs_reselection' ? 'area_needs_reselection' : 'no_area',
  }
}

/** Search parameters for a scope; nothing for "resolving" or "none". */
export function scopeSearchParams(scope: DiscoveryScope) {
  if (scope.status !== 'ready') return {}
  if (scope.source === 'gps') return { lat: scope.position.lat, lng: scope.position.lng }
  if (scope.source === 'profile_area' || scope.source === 'selected_area' || scope.source === 'default_area') {
    return {
      datasetVersion: scope.area.datasetVersion,
      provinceCode: scope.area.provinceCode,
      ...(scope.area.communeCode ? { communeCode: scope.area.communeCode } : {}),
    }
  }
  return {}
}
