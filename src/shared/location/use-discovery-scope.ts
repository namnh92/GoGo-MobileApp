import { useCallback, useEffect, useRef, useState } from 'react'

import { appActivity } from '@/shared/api/realtime/app-activity'

import { readFreshPosition, type LocationReader, type Position } from './fresh-position'

/**
 * ADM-204 (#209) — where discovery should look, in the order the product asked
 * for: a fresh device position, else the account's canonical area, else an
 * honest "no location" state. Never both: the server keeps a position and an
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
  | { status: 'ready'; source: 'gps'; position: Position }
  | { status: 'ready'; source: 'profile_area'; area: ScopeArea }
  | { status: 'ready'; source: 'none'; reason: 'no_area' | 'area_needs_reselection' }

type ProfileArea = (ScopeArea & { status: 'current' | 'needs_reselection' }) | null | undefined

/** Foreground returns closer together than this reuse the last answer. */
export const RECHECK_MIN_INTERVAL_MS = 60_000

function loadLocation(): LocationReader | null {
  try {
    // A binary built without the module throws at import time; lazy-load it so
    // Home degrades to the account area instead of crashing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-location') as LocationReader
  } catch {
    return null
  }
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

export function useDiscoveryScope({
  profileArea,
  profilePending,
}: {
  profileArea: ProfileArea
  profilePending: boolean
}) {
  // undefined: not checked yet; null: checked, nothing usable.
  const [position, setPosition] = useState<Position | null | undefined>(undefined)
  const lastCheck = useRef(0)
  const inFlight = useRef(false)
  const mounted = useRef(true)

  const check = useCallback(async (force: boolean) => {
    if (inFlight.current) return
    if (!force && lastCheck.current !== 0 && Date.now() - lastCheck.current < RECHECK_MIN_INTERVAL_MS) return
    inFlight.current = true
    lastCheck.current = Date.now()
    try {
      const next = await readFreshPosition(loadLocation())
      if (mounted.current) setPosition(next)
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void check(true)
    // Returning to the app is when a permission change in Settings shows up.
    const unsubscribe = appActivity.subscribe(active => {
      if (active) void check(false)
    })
    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [check])

  const recheck = useCallback(() => check(true), [check])
  return { scope: scopeFor(position, profileArea, profilePending), recheck }
}

/** Search parameters for a scope; nothing for "resolving" or "none". */
export function scopeSearchParams(scope: DiscoveryScope) {
  if (scope.status !== 'ready') return {}
  if (scope.source === 'gps') return { lat: scope.position.lat, lng: scope.position.lng }
  if (scope.source === 'profile_area') {
    return {
      datasetVersion: scope.area.datasetVersion,
      provinceCode: scope.area.provinceCode,
      ...(scope.area.communeCode ? { communeCode: scope.area.communeCode } : {}),
    }
  }
  return {}
}
