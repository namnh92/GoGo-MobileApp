import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react-native'

// Initialises the shared i18next instance, so assertions read the Vietnamese
// copy a user sees rather than raw translation keys.
import '@/shared/i18n'
import type { RoomSummary } from '@/shared/api'

/** A TanStack Query result narrowed to what the screens actually read. */
export interface QueryLike {
  isPending: boolean
  isError: boolean
  /** Waiting for the network; TanStack Query sets it while offline. */
  isPaused?: boolean
  data: unknown
  error: unknown
  refetch: () => void
}

export function pending(): QueryLike {
  return { isPending: true, isError: false, data: undefined, error: null, refetch: jest.fn() }
}

/** Nothing cached, and the fetch is paused until the device is back online. */
export function pausedOffline(): QueryLike {
  return { isPending: true, isError: false, isPaused: true, data: undefined, error: null, refetch: jest.fn() }
}

export function failed(error: unknown = new Error('boom')): QueryLike {
  return { isPending: false, isError: true, data: undefined, error, refetch: jest.fn() }
}

export function loaded(data: unknown): QueryLike {
  return { isPending: false, isError: false, data, error: null, refetch: jest.fn() }
}

export type Audience = 'couple' | 'group-host' | 'group-guest'

/**
 * The three audiences a screen must render differently. `myRole` is what the
 * server reports, and `roomCapabilities` turns it into permissions — so a test
 * that swaps audience really does swap the rendered affordances.
 */
export function roomFor(
  audience: Audience,
  overrides: Partial<RoomSummary> = {},
  { everyonePicked = false } = {},
): RoomSummary {
  const base = {
    id: 'room-1',
    status: 'collecting',
    decisionMode: 'match',
    participantCount: audience === 'couple' ? 2 : 4,
    currency: 'VND',
    constraints: { budgetMode: 'per_person', budgetAmount: 300_000, currency: 'VND', administrativeArea: null },
    myMemberId: 'me',
    // `memberProgress` reads this roster, and the host's start-matching action
    // only appears once every member has finished picking.
    members: Array.from({ length: audience === 'couple' ? 2 : 4 }, (_, index) => ({
      id: index === 0 ? 'me' : `member-${index}`,
      displayName: index === 0 ? 'Tôi' : `Người ${index}`,
      role: (index === 0 ? 'host' : 'member') as 'host' | 'member',
      selectionStatus: (everyonePicked ? 'completed' : 'pending') as 'completed' | 'pending',
      isGuest: false,
    })),
  }
  const shape =
    audience === 'couple'
      ? { type: 'couple', myRole: 'host' }
      : audience === 'group-host'
        ? { type: 'group', myRole: 'host' }
        : { type: 'group', myRole: 'member' }
  return { ...base, ...shape, ...overrides } as RoomSummary
}

/**
 * RNTL 14 returns a promise from `render` and exposes the queries on the
 * `screen` singleton, so every call site must await before asserting.
 */
export async function renderScreen(element: ReactElement) {
  await render(element)
  return screen
}
